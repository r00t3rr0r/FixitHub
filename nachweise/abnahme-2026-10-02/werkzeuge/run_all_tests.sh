#!/bin/bash
# Fuehrt alle Testdateien mit isUnsafeTestUri-Schutz nacheinander aus (Wegwerf-DBs, Netzwerkschutz).
S=/tmp/fixithub-e2e
TAG=${1:-run}
OUT=$S/testruns/$TAG; mkdir -p $OUT; : > $OUT/summary.txt
cd /home/adar/Projects/FixitHub
for f in $(grep -l "isUnsafeTestUri" test-*.js | sort); do
  n=$(basename $f .js | tr '-' '_' | cut -c1-40)
  rm -f $OUT/$n.netguard
  start=$(date +%s)
  NODE_OPTIONS="--require $S/netguard.js" NETGUARD_BLOCK_PORTS=27017 NETGUARD_LOG=$OUT/$n.netguard EMAIL_TEST_TRANSPORT=stream NODE_PATH=$S/e2e/shims TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_${TAG}_$n timeout 900 node $f > $OUT/$n.log 2>&1
  code=$?
  dur=$(( $(date +%s) - start ))
  last=$(grep -aE "(bestanden|passed|PASS).*(fehlgeschlagen|failed|FAIL)|==== " $OUT/$n.log | tail -1 | cut -c1-110)
  blocked=$([ -s $OUT/$n.netguard ] && echo "NETGUARD:$(wc -l < $OUT/$n.netguard)" || echo "net:0")
  printf "%-48s exit=%-3s %4ss %-10s %s\n" "$f" "$code" "$dur" "$blocked" "$last" >> $OUT/summary.txt
done
echo DONE >> $OUT/summary.txt
