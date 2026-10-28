#!/bin/bash
# usage: run.sh chNN
set -e
c=$1; W=/tmp/claude-0/ocrwork/$c; mkdir -p $W; cd $W
pdftoppm -r 300 -gray -png /tmp/claude-0/bdpdf/$c.pdf p
export OMP_THREAD_LIMIT=1
for img in p-*.png; do
  b=${img%.png}; [ -f $b.md ] && continue
  python3 -I /tmp/claude-0/ocrwork/prep.py $img $b.bin.png
  tesseract $b.bin.png $b.m -l Bengali+eng --psm 3 tsv 2>/dev/null
  tesseract $b.bin.png $b.b -l Bengali --psm 3 tsv 2>/dev/null
  python3 -I /tmp/claude-0/ocrwork/merge.py $b.m.tsv $b.b.tsv > $b.md
  rm -f $img
done
echo done $c
