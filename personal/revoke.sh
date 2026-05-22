#!/bin/bash

PGUSER="postgres"        # change if your superuser is different
PGHOST="172.30.19.51"       # change if needed
PGPORT="5432"            # change if needed

ROLE="global_rw"

DBS=(
  virtualoffice
  billing_pg50
  cgno
  autoform
  cardstream
  cogno-v2
  cogno_db
  ccdbs_pg50
  ave
  aws_connect
  acx
  basic_ivrs
  adhki_messaging
  agent_session
  cogno_db_old
  contact
  ellie_ai_chatbot
  harbor-dev1
  homer_config
  homer_data
  keep
  keycloak
  knowledgehub_db
  line_testing
  loneworkerdb
  medihub
  msgreports_pg50
  msgstore_pg50
  new_test_db
  pbxmanager_db
  qip_db
  recordings_manager
  references
  reportdb
  robo_agent
  single_telephony
  superset
  superseva
  switchboard
  ttsdb
  virtualoffice_03_04_26
  wise
)

for db in "${DBS[@]}"; do
  echo "=== Processing database: $db ==="
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$db" -v ON_ERROR_STOP=1 -c "REASSIGN OWNED BY $ROLE TO postgres;" || {
    echo "REASSIGN OWNED failed on $db, continuing..."
  }
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$db" -v ON_ERROR_STOP=1 -c "DROP OWNED BY $ROLE CASCADE;" || {
    echo "DROP OWNED failed on $db, continuing..."
  }
done

echo "=== Trying to drop role $ROLE ==="
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -c "DROP ROLE $ROLE;"
