// Abgleich eines Y.Doc mit anderen Geräten.
// - WebRTC über Trystero: öffentliche Nostr-Relays vermitteln nur den (mit dem Passwort
//   verschlüsselten) Verbindungsaufbau, die Daten gehen direkt von Gerät zu Gerät.
// - BroadcastChannel: andere Tabs im selben Browser (z. B. Testprofile mit ?p=…).
import * as Y from 'yjs'
import { signal } from '@preact/signals'
import { joinRoom, selfId, type DataPayload, type Room } from 'trystero'
import { sha256hex } from './crypto'

export const APP_ID = 'flowerpower-p2p-v1'

export type Hello = { member?: string; name?: string; avatar?: string; device?: string }

export type PeeringOpts = {
  roomId: string
  password: string
  doc?: Y.Doc
  /** 'legacy' = alter Raum nach Schlüsselwechsel: nur Wechsel-Hinweise weiterreichen, keine Daten. */
  mode: 'full' | 'legacy'
  hello: () => Hello
  getRekeys?: () => unknown[]
  onRekeys?: (recs: unknown[]) => void
}

const tabId = Math.random().toString(36).slice(2)
type BcMsg = { k: 'hi' | 'sv' | 'up' | 'rk' | 'bye'; from: string; to?: string; data?: unknown }

export class Peering {
  readonly peers = signal<Record<string, Hello>>({})
  readonly error = signal<string | null>(null)
  private room?: Room
  private bc?: BroadcastChannel
  private bcSeen = new Map<string, number>()
  private timers: ReturnType<typeof setInterval>[] = []
  private originRtc = {}
  private originBc = {}
  private pendingRtc: Uint8Array[] = []
  private pendingBc: Uint8Array[] = []
  private flushTimer?: ReturnType<typeof setTimeout>
  private closed = false
  private sendHi?: (h: Hello, target?: string) => void
  private sendRk?: (recs: unknown[]) => void

  constructor(private o: PeeringOpts) {
    this.start()
  }

  private setPeer(id: string, h: Hello | null) {
    const p = { ...this.peers.peek() }
    if (h) p[id] = h
    else delete p[id]
    this.peers.value = p
  }

  private start() {
    const { doc, mode } = this.o
    const room = joinRoom({ appId: APP_ID, password: this.o.password }, this.o.roomId, {
      onJoinError: (d) => {
        console.warn('Verbindung fehlgeschlagen', d)
        this.error.value = String(d.error ?? 'Verbindung fehlgeschlagen')
      },
    })
    this.room = room
    const hi = room.makeAction<Hello>('hi')
    const sv = room.makeAction<Uint8Array>('sv')
    const up = room.makeAction<Uint8Array>('up')
    const rk = room.makeAction('rk')
    this.sendHi = (h, target) => void hi.send(h, target ? { target } : undefined)
    this.sendRk = (recs) => void rk.send(recs as DataPayload)

    room.onPeerJoin = (peer) => {
      this.error.value = null
      this.setPeer(peer, {})
      void hi.send(this.o.hello(), { target: peer })
      if (doc && mode === 'full') void sv.send(Y.encodeStateVector(doc), { target: peer })
      const recs = this.o.getRekeys?.()
      if (recs?.length) void rk.send(recs as DataPayload, { target: peer })
    }
    room.onPeerLeave = (peer) => this.setPeer(peer, null)
    hi.onMessage = (h, { peerId }) => this.setPeer(peerId, h ?? {})
    rk.onMessage = (recs) => {
      if (Array.isArray(recs)) this.o.onRekeys?.(recs)
    }

    if (doc && mode === 'full') {
      sv.onMessage = (data, { peerId }) => {
        const update = Y.encodeStateAsUpdate(doc, new Uint8Array(data as unknown as ArrayBuffer))
        void up.send(update, { target: peerId })
      }
      up.onMessage = (data) => {
        try {
          Y.applyUpdate(doc, new Uint8Array(data as unknown as ArrayBuffer), this.originRtc)
        } catch (e) {
          console.warn('Ungültiges Update', e)
        }
      }
      doc.on('update', this.onLocalUpdate)
      // Sicherheitsnetz: regelmäßig Stände vergleichen
      this.timers.push(
        setInterval(() => {
          if (Object.keys(room.getPeers()).length) void sv.send(Y.encodeStateVector(doc))
        }, 25_000),
      )
      this.flushRtc = () => {
        if (!this.pendingRtc.length) return
        const merged = Y.mergeUpdates(this.pendingRtc)
        this.pendingRtc = []
        if (Object.keys(room.getPeers()).length) void up.send(merged)
      }
    }
    void this.startBc()
  }

  private flushRtc = () => {}
  private flushBc = () => {}

  private onLocalUpdate = (u: Uint8Array, origin: unknown) => {
    if (origin !== this.originRtc) this.pendingRtc.push(u)
    if (origin !== this.originBc) this.pendingBc.push(u)
    if (!this.flushTimer)
      this.flushTimer = setTimeout(() => {
        this.flushTimer = undefined
        this.flushRtc()
        this.flushBc()
      }, 60)
  }

  private async startBc() {
    if (typeof BroadcastChannel === 'undefined') return
    const name = 'fp-bc-' + (await sha256hex(this.o.roomId + '\n' + this.o.password)).slice(0, 32)
    if (this.closed) return
    const bc = new BroadcastChannel(name)
    this.bc = bc
    const { doc, mode } = this.o
    const post = (m: Omit<BcMsg, 'from'>) => bc.postMessage({ ...m, from: tabId })
    const hello = (to?: string) => {
      post({ k: 'hi', to, data: this.o.hello() })
      if (doc && mode === 'full') post({ k: 'sv', to, data: Y.encodeStateVector(doc) })
      const recs = this.o.getRekeys?.()
      if (recs?.length) post({ k: 'rk', to, data: recs })
    }
    bc.onmessage = (ev: MessageEvent<BcMsg>) => {
      const m = ev.data
      if (!m || m.from === tabId || (m.to && m.to !== tabId)) return
      const pid = 'bc:' + m.from
      if (m.k === 'bye') {
        this.bcSeen.delete(pid)
        this.setPeer(pid, null)
        return
      }
      const isNew = !this.bcSeen.has(pid)
      this.bcSeen.set(pid, Date.now())
      if (m.k === 'hi') {
        this.setPeer(pid, (m.data as Hello) ?? {})
        if (isNew) hello(m.from)
      } else if (m.k === 'sv' && doc && mode === 'full') {
        post({ k: 'up', to: m.from, data: Y.encodeStateAsUpdate(doc, m.data as Uint8Array) })
      } else if (m.k === 'up' && doc && mode === 'full') {
        Y.applyUpdate(doc, m.data as Uint8Array, this.originBc)
      } else if (m.k === 'rk' && Array.isArray(m.data)) {
        this.o.onRekeys?.(m.data)
      }
    }
    if (doc && mode === 'full') {
      this.flushBc = () => {
        if (!this.pendingBc.length) return
        const merged = Y.mergeUpdates(this.pendingBc)
        this.pendingBc = []
        post({ k: 'up', data: merged })
      }
    }
    hello()
    this.timers.push(
      setInterval(() => {
        post({ k: 'hi', data: this.o.hello() })
        const now = Date.now()
        for (const [pid, t] of this.bcSeen)
          if (now - t > 30_000) {
            this.bcSeen.delete(pid)
            this.setPeer(pid, null)
          }
      }, 10_000),
    )
    addEventListener('pagehide', this.bye)
  }

  private bye = () => this.bc?.postMessage({ k: 'bye', from: tabId })

  /** Neue Profil-Infos (Name/Avatar) an alle schicken. */
  announce() {
    this.sendHi?.(this.o.hello())
    this.bc?.postMessage({ k: 'hi', from: tabId, data: this.o.hello() })
  }

  /** Wechsel-Hinweise sofort an alle verteilen. */
  pushRekeys() {
    const recs = this.o.getRekeys?.()
    if (!recs?.length) return
    this.sendRk?.(recs)
    this.bc?.postMessage({ k: 'rk', from: tabId, data: recs })
  }

  destroy() {
    this.closed = true
    this.o.doc?.off('update', this.onLocalUpdate)
    this.timers.forEach(clearInterval)
    this.bye()
    removeEventListener('pagehide', this.bye)
    this.bc?.close()
    void this.room?.leave()
    this.peers.value = {}
  }
}

export { selfId }

/** Raum-ID aus Gruppenname + Passwort: verschiedene Passwörter landen in verschiedenen Räumen. */
export async function roomIdFor(name: string, password: string) {
  return 'fp-' + (await sha256hex(name.trim().toLowerCase() + '\n' + password)).slice(0, 40)
}
