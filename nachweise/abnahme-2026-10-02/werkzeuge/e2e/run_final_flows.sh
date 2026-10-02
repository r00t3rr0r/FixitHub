#!/bin/bash
# Fuehrt ALLE Browser-Ablaeufe nacheinander gegen den isolierten Testserver aus (frisch neu gestartet) und sammelt die Ergebnisse.
S=/tmp/fixithub-e2e
TAG=${1:-final3}
cd $S/e2e
OUT=$S/flows/_summary_$TAG.txt; : > $OUT
NG_BEFORE=$(cat $S/e2e/netguard_after.log 2>/dev/null | wc -l)
NODE_OPTIONS="--require $S/netguard.js" NETGUARD_BLOCK_PORTS=27017 node setup_kasse.js > /dev/null 2>&1
rm -f state_kasse.json
FLOWS=${FLOWS:-"flow_k01_messages flow_k02_sources flow_k03_source_error flow_k06_workflow_notify flow_k07_guest_quote flow_k07b_catalog_convert flow_k08_k09 flow_k08_device_service_change flow_k09_technician_workflow flow_k10_k11 flow_k11_admin_label_download flow_k12_k17 flow_k14 flow_k15_payment_dialogs flow_k16_settings flow_k17_epart_order_tracking flow_extra flow_lost1_quick_action"}
for flow in $FLOWS; do
  [ -f $flow.js ] || { printf "%-32s FEHLT\n" "${flow#flow_}" >> $OUT; continue; }
  name=${flow#flow_}
  rm -rf $S/flows/$name
  start=$(date +%s)
  timeout 1200 node $flow.js > $S/flows/_log_$name.txt 2>&1
  code=$?
  res=$(grep -aE "^==== " $S/flows/_log_$name.txt | tail -1)
  printf "%-32s exit=%-3s %4ss %s\n" "$name" "$code" "$(( $(date +%s) - start ))" "$res" >> $OUT
done
NG_AFTER=$(cat $S/e2e/netguard_after.log 2>/dev/null | wc -l)
echo "server netguard: $NG_BEFORE -> $NG_AFTER blockierte Verbindungen" >> $OUT
echo DONE >> $OUT
