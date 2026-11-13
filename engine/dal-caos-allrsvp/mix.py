"""Colonna sonora originale di "Dal caos all'RSVP" (sintesi in codice, nessun campione di terzi).
Legge events.json (esportato dalla stessa timeline della pagina) e scrive out/mix.wav (48 kHz stereo, 30 s)."""
import json, os, sys
import numpy as np, soundfile as sf
from scipy.signal import fftconvolve

HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.environ.get('LIB', os.path.expanduser('~/lemo-opuscar'))
sys.path.insert(0, os.path.join(LIB, 'core', 'audio'))
import sfx
SR = sfx.SR
DUR = 30.0
ev = json.load(open(os.path.join(HERE, 'events.json')))['ev']
N = int(DUR * SR)
rng = np.random.default_rng(11)

def mf(m): return 440.0 * 2 ** ((m - 69) / 12)
def tt(d): return np.arange(int(round(d * SR))) / SR

def bell(f, tau=.35, d=None, bright=1.0):
    d = d or tau * 6; t = tt(d)
    x = (np.sin(2*np.pi*f*t) + .30*bright*np.sin(2*np.pi*f*2.0*t)*np.exp(-t/(tau*.55)) +
         .12*bright*np.sin(2*np.pi*f*3.99*t)*np.exp(-t/(tau*.3))) * np.exp(-t/tau)
    a = np.minimum(1, t/0.004); return x * a

def epiano(f, d, v=.6):
    d = d + 0.4; t = tt(d); tau = 0.55 + 0.9 * (261.6 / f) ** .6
    parts = [(1, 1, 1.0), (2, .42, .7), (3, .18, .5), (4, .09, .35), (5, .05, .25)]
    x = sum(a * np.sin(2*np.pi*f*k*t + .3*k) * np.exp(-t/(tau*dm)) for k, a, dm in parts)
    x += .10 * np.sin(2*np.pi*f*7*t) * np.exp(-t/.09)          # tine
    x *= np.minimum(1, t/0.006) * np.minimum(1, (d - t)/0.35)
    x = sfx.lp(x, 4800)
    return x * v

def bass(f, d, v=.5):
    d = d + .3; t = tt(d); tau = 1.1
    x = (np.sin(2*np.pi*f*t) + .45*np.sin(2*np.pi*f*2*t)*np.exp(-t/.5) + .22*np.sin(2*np.pi*f*3*t)*np.exp(-t/.3)) * np.exp(-t/tau)
    x *= np.minimum(1, t/0.012) * np.minimum(1, (d - t)/0.25)
    return x * v

def pad(freqs, d, v=.3):
    t = tt(d); x = 0
    for f in freqs:
        for det in (-.0035, 0, .0035):
            x = x + np.sin(2*np.pi*f*(1+det)*t + rng.random()*6)
    x = x / (3 * len(freqs))
    env = np.minimum(1, t/1.8) * np.minimum(1, (d - t)/1.8)
    return sfx.lp(x, 1800) * env * v

def tap(v=.5):
    d = .22; t = tt(d); f = 190 - 70*t/d
    body = np.sin(2*np.pi*np.cumsum(f)/SR) * np.exp(-t/.05)
    tick = sfx.hp(sfx.noise(d), 2200) * np.exp(-t/.004) * .22
    return (body + tick) * v

def softwhoosh(d=.7, v=.3):
    n = sfx.noise(d); t = tt(d)
    x = sfx.bp(n, 500, 3200) ; env = np.sin(np.pi * np.clip(t/d, 0, 1)) ** 2
    return sfx.lp(x * env, 3000) * v

S = np.zeros((N, 2)); M = np.zeros((N, 2))

# --- fondo: quinta bassissima fino all'ingresso della musica (shot 1-2) ---
add = sfx.add
add(S, pad([mf(48), mf(55)], 11.5, 1.0), 0.0, .10)

for e in ev:
    k, t = e['type'], e['t']
    if k == 'ping':                       # notifica soft della chat
        f = [mf(84), mf(88), mf(91), mf(81)][e.get('i', 0) % 4]
        add(S, bell(f, .22, 1.0), t, .16, -.35 if e.get('side') == 'l' else .35)
    elif k == 'key':                      # tasti del foglio
        add(S, sfx.click(.75 + .5 * rng.random(), 1.0) * .45, t, .22, rng.uniform(-.2, .2))
    elif k == 'whoosh':
        add(S, softwhoosh(.75, .5), t - .1, .30)
    elif k == 'tap':
        add(S, tap(.7), t, .42)
        add(S, bell(mf(79), .15, .6) * .5, t + .02, .12)
    elif k == 'chime':                    # conferma: arpeggio ascendente
        for j, m in enumerate([72, 76, 79, 84]):
            add(S, bell(mf(m), .55, 2.4), t + j * .13, .26, .0)
    elif k == 'tick':                     # contatore che sale
        i = e.get('i', 0)
        add(S, bell(mf(79 + [0, 2, 4, 7][i % 4]), .4, 1.8), t, .26, .1)
        add(S, bell(mf(91 + [0, 2, 4, 7][i % 4]), .25, 1.0), t + .06, .09, .25)
    elif k == 'sort':
        add(S, softwhoosh(.55, .3), t, .12)
    elif k == 'press':
        add(S, tap(.7), t, .38)
        add(S, bell(mf(84), .8, 2.4), t + .05, .22)
        add(S, bell(mf(88), .8, 2.4), t + .18, .16)

# --- musica: entra a 10.0 su battuta, 96 bpm, 8 battute (CHIUSURA sul Do) ---
t0 = 10.0; beat = 60 / 96; bar = beat * 4; eighth = beat / 2
chords = [  # (radice basso, note arpeggio)
    (36, [60, 64, 67, 71]),   # Cmaj7
    (33, [57, 60, 64, 67]),   # Am7
    (41, [53, 57, 60, 64]),   # Fmaj7
    (43, [55, 59, 62, 64]),   # G6
    (36, [60, 64, 67, 72]),   # C
    (41, [57, 60, 65, 69]),   # F
    (43, [55, 60, 62, 67]),   # Gsus
    (36, [60, 64, 67, 74]),   # Cadd9 (finale)
]
pat = [0, 1, 2, 3, 2, 1, 2, 1]
for b, (root, notes) in enumerate(chords):
    bt = t0 + b * bar
    last = b == len(chords) - 1
    lvl = [.50, .58, .66, .72, .90, .95, 1.0, 1.0][b]     # crescendo verso lo shot 5-6
    if last:
        # accordo finale arpeggiato lento che risuona fino alla fine
        for j, m in enumerate([48, 55, 60, 64, 67, 74]):
            add(M, epiano(mf(m), 2.3, .55 * (1.0 if m > 50 else .7)), bt + j * .07, .5 * lvl, (j - 2.5) * .08)
        add(M, bass(mf(36), 2.2, .6), bt, .5)
        add(M, bell(mf(84), 1.4, 1.5) * .6, bt + .5, .16)
        add(M, bell(mf(91), 1.6, 1.5) * .6, bt + 1.0, .12)
        add(M, pad([mf(48), mf(55), mf(60), mf(64)], 2.45, .5), bt, .22)
        continue
    for j, p in enumerate(pat):
        m = notes[p] + (12 if (b >= 4 and j % 4 == 2) else 0)
        add(M, epiano(mf(m), eighth * 2.5, .55), bt + j * eighth, .42 * lvl * (1.0 if j % 4 == 0 else .8), (j % 4 - 1.5) * .12)
    add(M, pad([mf(root + 24), mf(root + 31), mf(notes[1])], bar + .4, .35), bt, .18 + .05 * b/7)
    add(M, bass(mf(root), beat * 1.9, .55), bt, .45 * (.5 if b < 2 else 1.0))
    if b >= 2: add(M, bass(mf(root), beat * 1.9, .5), bt + beat * 2, .32)
    if b >= 4:                                         # crescita: campanelle in alto
        add(M, bell(mf(notes[2] + 24), .8, 1.4), bt + beat, .14, .25)
        add(M, bell(mf(notes[3] + 24), .8, 1.4), bt + beat * 3, .12, -.25)

# riverbero morbido sulla musica
ir_n = int(1.6 * SR); ir_t = np.arange(ir_n) / SR
ir = sfx.lp(rng.standard_normal(ir_n), 3500) * np.exp(-ir_t / .38); ir[:int(.012*SR)] *= np.linspace(0, 1, int(.012*SR))
for c in (0, 1):
    wet = fftconvolve(M[:, c], ir * (1 if c == 0 else -1) * .02)[:N]
    M[:, c] = M[:, c] * .82 + wet * .55
S[:, 0] += 0; mix = M * 1.0 + S * 1.0

# dissolvenza finale (ultimi 0.6 s) e ingresso morbido
fo = np.clip((DUR - np.arange(N)/SR) / 0.6, 0, 1); fi = np.clip(np.arange(N)/SR / .05, 0, 1)
mix *= (fo * fi)[:, None]
mix = np.nan_to_num(mix); pk = np.abs(mix).max(); mix = mix * (.8 / pk)
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
sf.write(os.path.join(HERE, 'out', 'mix.wav'), mix.astype(np.float32), SR)
print('mix.wav ok, picco %.3f, durata %.2f s' % (pk, N / SR))
