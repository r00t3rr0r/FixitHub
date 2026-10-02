#!/bin/bash
# Startet den isolierten "nachher"-Testserver (Port 5099, DB e2e_after) neu - mit Netzwerkschutz und Test-Postfach.
S=/tmp/fixithub-e2e
cd /home/adar/Projects/FixitHub
for f in $(git status --porcelain | awk '{print $2}' | grep -E '^server/.*\.js$'); do node --check "$f" 2>/dev/null || { echo "SYNTAX FAIL $f - kein Neustart"; exit 1; }; done
PID=$(ss -ltnp 2>/dev/null | grep ':5099 ' | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2)
if [ -n "$PID" ]; then case "$(tr '\0' ' ' < /proc/$PID/cmdline)" in *"node server.js"*) kill $PID; sleep 2;; *) echo "Port 5099 belegt von fremdem Prozess"; exit 1;; esac; fi
ADMIN_PW_FILE=$S/e2e/.adminpw
cd server && nohup env SEED_ADMIN_PASSWORD="$(cat $ADMIN_PW_FILE)" NETGUARD_LOG=$S/e2e/netguard_after.log NETGUARD_BLOCK_PORTS=27017 NODE_OPTIONS="--require $S/netguard.js --require $S/e2e/mailcapture.js" MAIL_CAPTURE_DIR=$S/mailbox NODE_PATH=$S/e2e/shims EMAIL_TEST_TRANSPORT=stream DUNNING_CRON_ENABLED=false PORT=5099 DATABASE_URL=mongodb://127.0.0.1:27099/e2e_after MONGODB_URI=mongodb://127.0.0.1:27099/e2e_after GOOGLE_REVIEW_URL= node server.js > $S/e2e/server_after.log 2>&1 &
for i in $(seq 1 60); do sleep 1; c=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5099/api/auth/me 2>/dev/null); [ "$c" != "000" ] && [ -n "$c" ] && { echo "after-server up ${i}s"; exit 0; }; done
echo "after-server did not start"; tail -20 $S/e2e/server_after.log; exit 1
