import io, sys

P = "townwright.html"
src = io.open(P, encoding="utf-8").read()
orig_len = len(src)

def frag(name):
    t = io.open("frags/%s.js" % name, encoding="utf-8").read().rstrip()
    return t + "\n\n"

def replace_between(s, a, b, new):
    i = s.index(a)
    j = s.index(b, i)
    return s[:i] + new + s[j:]

def insert_before(s, a, new):
    i = s.index(a)
    return s[:i] + new + s[i:]

# version bump
assert 'var VERSION="1.0.0";' in src
src = src.replace('var VERSION="1.0.0";', 'var VERSION="2.0.0";', 1)

# 1) archetype layer before region
src = insert_before(src, "/* ================= region ================= */", frag("arch"))
# 2) founding (archetype founding weights)
src = replace_between(src, "/* ================= founding ================= */",
                      "/* ============== industry strengths (potential) ============== */", frag("founding"))
# 3) simulation (quality + archetype events/infra)
src = replace_between(src, "/* ================= simulation ================= */",
                      "/* ================= economy ================= */", frag("sim"))
# 4) economy (quality-tagged industries, archetype occupations)
src = replace_between(src, "/* ================= economy ================= */",
                      "/* ================= people ================= */", frag("eco"))
# 5) people (archetype rulers/notables/masters)
src = replace_between(src, "/* ================= people ================= */",
                      "/* ================= names ================= */", frag("people"))
# 6) names + prose (archetype morphemes/epithets/prose, quality sentences)
src = replace_between(src, "/* ================= names ================= */",
                      "/* ================= map geometry ================= */", frag("namesprose"))
# 7) map model v2 (crossings, wall-safe footprints, farm packing, arch complexes)
src = replace_between(src, "/* ================= map model ================= */",
                      "/* ================= generate ================= */", frag("mapmodel"))
# 8) generate + export (replace through end of globalThis export statement)
ga = "/* ================= generate ================= */"
i = src.index(ga)
j = src.index("globalThis.Townwright={", i)
k = src.index("};", j) + 2
src = src[:i] + frag("generate").rstrip() + "\n" + src[k:]

io.open(P, "w", encoding="utf-8").write(src)
print("spliced: %d -> %d bytes" % (orig_len, len(src)))
