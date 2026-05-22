# Liquibase CI/CD Ansible Playbook
## 3-Server Setup: PostgreSQL + Migration Server + GitHub Actions Runner

---

## Architecture

```
┌──────────────────────┐       ┌──────────────────────┐       ┌──────────────────────┐
│   CI/CD Server        │──SSH─▶│  Migration Server     │──JDBC─▶│  PostgreSQL Server    │
│   (GitHub Runner)     │       │  (Liquibase + Java)   │ :5432  │  (DB only)           │
│   192.168.1.30        │       │  192.168.1.20         │       │  192.168.1.10         │
└──────────────────────┘       └──────────────────────┘       └──────────────────────┘
         ▲
    triggered by
  GitHub Pull Request
  or Merge to main
```

---

## Prerequisites

On your **control machine** (your laptop or a jump host):

```bash
# Install Ansible
pip install ansible

# Install required collections
ansible-galaxy collection install community.postgresql community.general
```

---

## Step 1: Configure Your Variables

Edit `group_vars/all.yml` and update:

| Variable | What to change |
|---|---|
| `pg_host` | IP of your PostgreSQL server |
| `pg_password` | Strong database password |
| `github_org` | Your GitHub organization or username |
| `github_repo` | Your repository name |
| `github_runner_token` | Token from GitHub → Settings → Actions → Runners |

Edit `inventories/hosts.ini` and replace IPs:
- `192.168.1.10` → your PostgreSQL server IP
- `192.168.1.20` → your migration server IP  
- `192.168.1.30` → your CI/CD server IP

---

## Step 2: Secure Secrets with Ansible Vault (Recommended)

```bash
# Encrypt the password in group_vars/all.yml
ansible-vault encrypt_string 'StrongPass@2025' --name 'pg_password'

# Replace the plain-text pg_password in all.yml with the encrypted output
# Then run playbooks with:
ansible-playbook -i inventories/hosts.ini site.yml --ask-vault-pass
```

---

## Step 3: Test Connectivity

```bash
ansible all -i inventories/hosts.ini -m ping
```

Expected output:
```
db-server | SUCCESS => { "ping": "pong" }
migration-server | SUCCESS => { "ping": "pong" }
cicd-server | SUCCESS => { "ping": "pong" }
```

---

## Step 4: Run the Full Playbook

```bash
# Provision all 3 servers at once
ansible-playbook -i inventories/hosts.ini site.yml

# Or provision individually:
ansible-playbook -i inventories/hosts.ini playbooks/deploy_postgresql.yml
ansible-playbook -i inventories/hosts.ini playbooks/deploy_liquibase.yml
ansible-playbook -i inventories/hosts.ini playbooks/deploy_github_runner.yml
```

---

## Step 5: Copy Workflow to Your Repo

After running the playbook, copy the generated GitHub Actions workflow to your repo:

```bash
# From the CI/CD server:
scp ubuntu@192.168.1.30:/opt/workflows/db-migrate.yml \
    /path/to/your/repo/.github/workflows/db-migrate.yml

git add .github/workflows/db-migrate.yml
git commit -m "ci: add Liquibase migration workflow"
git push
```

---

## Step 6: Verify Everything Works

```bash
# On migration server - run a manual migration
ssh liquibase@192.168.1.20 "run-migration status"
ssh liquibase@192.168.1.20 "run-migration update"

# Check logs
ssh liquibase@192.168.1.20 "ls /var/log/liquibase/"
```

---

## Project Structure

```
liquibase-ansible/
├── site.yml                        # Master playbook (all 3 servers)
├── inventories/
│   └── hosts.ini                   # Server IPs and SSH config
├── group_vars/
│   └── all.yml                     # All variables (passwords, versions, etc.)
├── playbooks/
│   ├── deploy_postgresql.yml       # PostgreSQL server only
│   ├── deploy_liquibase.yml        # Migration server only
│   └── deploy_github_runner.yml    # CI/CD server only
└── roles/
    ├── postgresql/                 # PostgreSQL install + hardening
    │   ├── tasks/main.yml
    │   └── handlers/main.yml
    ├── liquibase/                  # Liquibase + Java + Python
    │   ├── tasks/main.yml
    │   └── templates/
    │       ├── liquibase.properties.j2
    │       ├── db.changelog-root.xml.j2
    │       ├── 001_create_users.sql.j2
    │       └── run_migration.sh.j2
    └── github-runner/              # Self-hosted runner
        ├── tasks/main.yml
        └── templates/
            └── db-migrate.yml.j2
```

---

## Common Commands After Setup

| Command | Where to run |
|---|---|
| `run-migration update` | Migration server |
| `run-migration status` | Migration server |
| `run-migration validate` | Migration server |
| `run-migration rollbackCount 1` | Migration server |
| `run-migration tag --tag=v1.0` | Migration server |
| `ansible-playbook site.yml` | Control machine |
# all_projects
