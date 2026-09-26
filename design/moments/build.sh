#!/bin/sh
# Rebuild the table-moments demo bundle from the real art modules. Run from statisticasino/.
set -e
D=design/moments
mkdir -p $D/games $D/deck-parts
cp static/games/*.svg $D/games/
cp static/deck-parts/*.svg $D/deck-parts/
npx esbuild $D/demo.js --bundle --format=iife --target=es2022 --minify --outfile=$D/demo.bundle.js
