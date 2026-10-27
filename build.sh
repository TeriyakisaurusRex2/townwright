#!/usr/bin/env bash
# Rebuild townwright.html from the v1 base + fragments, extract scripts, syntax-check.
# The HTML is GENERATED — edit frags/*.js, never townwright.html directly.
set -e
cd "$(dirname "$0")"

cp townwright.v1.bak.html townwright.html
python3 splice.py
python3 uisplice.py

python3 - <<'EOF'
import io
src = io.open("townwright.html", encoding="utf-8").read()
i = src.index('<script id="tw-engine">') + len('<script id="tw-engine">')
j = src.index('</script>', i)
io.open("engine2.js", "w", encoding="utf-8").write(src[i:j] + "\nmodule.exports=globalThis.Townwright;\n")
k = src.index('<script id="tw-ui">') + len('<script id="tw-ui">')
l = src.index('</script>', k)
io.open("ui2.js", "w", encoding="utf-8").write(src[k:l])
print("extracted engine2.js (%d) + ui2.js (%d)" % (j - i, l - k))
EOF

node --check engine2.js && echo "engine syntax OK"
node --check ui2.js && echo "ui syntax OK"
echo
echo "Build complete. Now run:"
echo "  node harness2.js   # 388-town geometry/archetype invariants"
echo "  node smoke.js      # 46 jsdom UI checks (needs: npm i jsdom)"
