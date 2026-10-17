# Запуск на сервере: пошаговый план (фаза N)

Актуально на фазу N-0. Файлы сервера лежат в `deploy/`. Справочник по переменным и процессам — `docs/deployment.md`. Безопасность — `docs/admin-security-asvs.md`.

> **Предположения, которые проверяем в понедельник.** Сервер — VPS на Host.KZ с **Ubuntu 24.04 LTS**, root-доступ по SSH, минимум 2 vCPU / 4 ГБ RAM / 40 ГБ SSD. Сборка сайта занимает до ~1,5 ГБ памяти. Если ОС другая, команды установки пакетов меняются, остальное то же.

---

## 0. Что нужно получить до начала

| # | Что | От кого | Без этого |
|---|---|---|---|
| 1 | IP сервера, SSH-доступ (root или sudo), ОС | Хостинг / клиент | нельзя начать |
| 2 | Доступ к DNS домена soltexglobal.co (панель регистратора) | Клиент | нет HTTPS и нельзя переключить сайт |
| 3 | SMTP: сервер, порт, логин, пароль, адрес отправителя; на домене — SPF, DKIM, DMARC | Клиент / почтовый провайдер | письма о заявках копятся в очереди и не уходят |
| 4 | Кто получает уведомления о заявках (e-mail) | Клиент | `LEAD_NOTIFY_TO` пустой |
| 5 | Где хранить копию бэкапов вне сервера (второй сервер, хранилище) | Клиент | бэкапы только на том же сервере |
| 6 | Кто будет Владельцем (Owner) админки: имя, e-mail | Клиент | некому выдать доступ |
| 7 | Тексты политики конфиденциальности и условий (юрист клиента) | Клиент | формы на сайте остаются выключенными, страниц /privacy и /terms нет |
| 8 | Включать ли второй фактор и для роли «Редактор» (`MFA_FOR_ALL_ROLES`) | Клиент | по умолчанию — нет |

Пункты 1–2 нужны в первый же день. Пункты 3–8 можно добавить позже, сайт работает и без них.

---

## 1. DNS (сразу, до установки)

1. Записи для админки и предпросмотра: `A admin.soltexglobal.co → IP` и `A preview.soltexglobal.co → IP` (и `AAAA`, если у сервера есть IPv6).
2. У записей `soltexglobal.co` и `www.soltexglobal.co` поставить TTL 300 (5 минут). Сами записи пока **не менять**: старый сайт работает до переключения (шаг 9).

---

## 2. Система

```bash
apt update && apt -y upgrade
apt -y install nginx git rsync curl ca-certificates gnupg certbot ufw unattended-upgrades
# Node.js 22 (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt -y install nodejs
node -v            # v22.12 или новее
# PostgreSQL 17 (официальный репозиторий PostgreSQL)
install -d /usr/share/postgresql-common/pgdg
curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc
echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt noble-pgdg main" > /etc/apt/sources.list.d/pgdg.list
apt update && apt -y install postgresql-17
# Межсетевой экран: только SSH, HTTP, HTTPS
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable
dpkg-reconfigure -plow unattended-upgrades     # автоматические обновления безопасности
```

Пользователи и каталоги:

```bash
useradd --system --home /srv/soltex --shell /usr/sbin/nologin soltex
useradd --system --home /var/backups/soltex --shell /usr/sbin/nologin soltex-backup
install -d -o soltex -g soltex -m 755 /srv/soltex /srv/soltex/media /srv/soltex/.worker-home
install -d -o root -g root -m 755 /srv/soltex/admin
install -d -o soltex-backup -g soltex-backup -m 700 /var/backups/soltex
install -d -o soltex-backup -g soltex-backup -m 755 /var/lib/soltex-backup
install -d -m 755 /etc/soltex /var/www/letsencrypt
```

---

## 3. Код

Код ставится в `/opt/soltex/app` (владелец root, служба только читает его).

- **Вариант А — из GitHub.** Добавить на сервере deploy key (только чтение), затем `git clone git@github.com:<репозиторий>.git /opt/soltex/app`.
- **Вариант Б — без доступа к GitHub.** Загрузить на сервер git bundle (`scp soltex.bundle root@IP:/root/`), затем `git clone /root/soltex.bundle /opt/soltex/app`.

```bash
cd /opt/soltex/app
npm ci --no-audit --no-fund
npm run lint && npm test
```

---

## 4. База данных

```bash
# пароли: по одному на роль, сохранить в менеджер паролей
openssl rand -base64 24   # ×3: migrate, app, backup
sudo -u postgres psql -v ON_ERROR_STOP=1 -v dbname=soltex \
  -v migrate_password='…' -v app_password='…' -v backup_password='…' \
  -f /opt/soltex/app/apps/api/db/provision.sql
```

PostgreSQL слушает только `127.0.0.1` (так по умолчанию в Ubuntu, проверить `listen_addresses` в `/etc/postgresql/17/main/postgresql.conf`).

---

## 5. Настройки (файлы окружения)

```bash
cp /opt/soltex/app/deploy/soltex.env.example /etc/soltex/soltex.env
cp /opt/soltex/app/deploy/migrate.env.example /etc/soltex/migrate.env
cp /opt/soltex/app/deploy/backup.env.example /etc/soltex/backup.env
# заполнить <…>; ключи: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
chown root:soltex /etc/soltex/soltex.env && chmod 640 /etc/soltex/soltex.env
chown root:root /etc/soltex/migrate.env && chmod 600 /etc/soltex/migrate.env
chown root:soltex-backup /etc/soltex/backup.env && chmod 640 /etc/soltex/backup.env
```

- `DATA_ENCRYPTION_KEYS` и `HASH_SECRET` сохранить в менеджер паролей. Без них не расшифровать вторые факторы и заявки из бэкапа.
- `WEBAUTHN_RP_ID=admin.soltexglobal.co` нельзя менять после запуска: иначе перестанут работать все ключи доступа.
- Формы на сайте (`SITE_LEADS_ENABLED`) остаются `false`, пока клиент не утвердит тексты о персональных данных.

---

## 6. Первое наполнение и Владелец

```bash
cd /opt/soltex/app
set -a; . /etc/soltex/migrate.env; set +a; npm run db:migrate
set -a; . /etc/soltex/soltex.env; set +a
npm run db:import                     # ТОЛЬКО один раз: контент из seed в базу
npm run auth:bootstrap-owner          # e-mail и пароль Владельца (пароль не отображается)
npm run build:admin && rsync -a --delete apps/admin/dist/ /srv/soltex/admin/
```

`db:import` больше никогда не запускать: при повторном запуске он перезапишет правки редакторов.

---

## 7. Службы

```bash
cp /opt/soltex/app/deploy/systemd/* /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now soltex-api soltex-worker soltex-preview soltex-backup.timer
systemctl status soltex-api soltex-worker soltex-preview
curl -s http://127.0.0.1:3100/api/v1/health     # {"status":"ok",…}
```

Журналы: `journalctl -u soltex-api -f` (и так же `soltex-worker`, `soltex-preview`).

---

## 8. HTTPS и nginx для админки и предпросмотра

```bash
# сертификаты (nginx ещё не настроен, порт 80 свободен)
systemctl stop nginx
certbot certonly --standalone -d admin.soltexglobal.co -m <e-mail> --agree-tos -n
certbot certonly --standalone -d preview.soltexglobal.co -m <e-mail> --agree-tos -n
systemctl start nginx
cp /opt/soltex/app/deploy/nginx/*.conf /etc/nginx/sites-available/
rm -f /etc/nginx/sites-enabled/default
ln -s /etc/nginx/sites-available/admin.soltexglobal.conf /etc/nginx/sites-enabled/
ln -s /etc/nginx/sites-available/preview.soltexglobal.conf /etc/nginx/sites-enabled/
```

Файл `admin.soltexglobal.conf` использует `upstream soltex_api` из `soltexglobal.conf`. Поэтому до шага 9 включить и сайт, а его сертификат временно заменить:

```bash
# временно: сайт на самоподписанном сертификате, пока DNS указывает на старый сайт
install -d /etc/letsencrypt/live/soltexglobal.co
openssl req -x509 -newkey rsa:2048 -nodes -days 7 -subj /CN=soltexglobal.co \
  -keyout /etc/letsencrypt/live/soltexglobal.co/privkey.pem -out /etc/letsencrypt/live/soltexglobal.co/fullchain.pem
ln -s /etc/nginx/sites-available/soltexglobal.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
# продление сертификатов без остановки nginx
certbot reconfigure --cert-name admin.soltexglobal.co --webroot -w /var/www/letsencrypt
certbot reconfigure --cert-name preview.soltexglobal.co --webroot -w /var/www/letsencrypt
echo 'systemctl reload nginx' > /etc/letsencrypt/renewal-hooks/deploy/nginx.sh && chmod +x /etc/letsencrypt/renewal-hooks/deploy/nginx.sh
SMOKE_SKIP_SITE=1 /opt/soltex/app/deploy/scripts/smoke.sh
```

Дальше Владелец входит на `https://admin.soltexglobal.co`. Порядок первого входа:

1. Регистрирует ключ доступа (passkey).
2. Сохраняет резервные коды.
3. Создаёт пользователей; каждый получает временный пароль.
4. Проверяет и при необходимости правит «Настройки сайта» и контент.
5. Создаёт первый релиз: «Публикация» → «Релизы».
6. Проверяет его через предпросмотр.
7. Публикует его: на сервере появится `/srv/soltex/current`.

---

## 9. Переключение сайта (DNS)

1. Убедиться, что в админке есть **активный** релиз и что предпросмотр показывает всё правильно.
2. В DNS: `A soltexglobal.co → IP`, `A www.soltexglobal.co → IP` (TTL уже 5 минут).
3. Через 5–10 минут (`dig +short soltexglobal.co` показывает новый IP) выпустить настоящий сертификат:

   ```bash
   rm -rf /etc/letsencrypt/live/soltexglobal.co      # временный самоподписанный
   systemctl stop nginx
   certbot certonly --standalone -d soltexglobal.co -d www.soltexglobal.co -m <e-mail> --agree-tos -n
   systemctl start nginx
   certbot reconfigure --cert-name soltexglobal.co --webroot -w /var/www/letsencrypt
   /opt/soltex/app/deploy/scripts/smoke.sh
   ```

   nginx стоит около 10 секунд. Админка в это время тоже недоступна.
4. В Google Search Console подтвердить домен и отправить `https://soltexglobal.co/sitemap.xml`.
5. Старые адреса `/about`, `/tech` и `/services` переводятся на новые (301) автоматически. Если клиент знает другие старые ссылки, их добавляют в «SEO → Редиректы».

**Откат:** вернуть прежние DNS-записи. Через 5 минут снова работает старый сайт.

---

## 10. Бэкапы

- Каждую ночь в 03:17 `soltex-backup.timer` запускает `deploy/scripts/backup.sh`. Он делает:
  - дамп базы (роль только для чтения), проверенный `pg_restore --list`;
  - снимок медиатеки, где неизменённые файлы — жёсткие ссылки на предыдущий снимок;
  - хранение 14 дней;
  - копию на внешний сервер, если задан `BACKUP_REMOTE`.
- Релизы не копируются: каждый релиз пересобирается из снимка контента в базе.
- Проверить сразу после установки: `systemctl start soltex-backup && journalctl -u soltex-backup -n 20`, затем `/opt/soltex/app/deploy/scripts/restore-check.sh`.
- Время последнего успешного бэкапа видно в админке: «Система» → «Резервные копии». Если бэкапа не было больше 36 часов, там будет предупреждение.
- Раз в месяц: `restore-check.sh`. Он восстанавливает последний дамп во временную базу, проверяет данные и удаляет её.
- Ключи `DATA_ENCRYPTION_KEYS` и `HASH_SECRET` в бэкап **не входят**. Их хранят отдельно, в менеджере паролей клиента.

---

## 11. Обновление кода

```bash
sudo /opt/soltex/app/deploy/scripts/update.sh                    # из GitHub (origin/main)
sudo /opt/soltex/app/deploy/scripts/update.sh /root/new.bundle   # из git bundle
```

Скрипт делает:

1. переносит код только вперёд (fast-forward);
2. ставит зависимости (`npm ci`) и прогоняет проверки (`lint`, `test`);
3. применяет миграции;
4. собирает админку;
5. перезапускает службы;
6. запускает smoke-тест.

Контент он не трогает. Публичный сайт меняется, только когда в админке публикуют релиз.

---

## 12. После запуска

- [ ] Smoke-тест проходит полностью.
- [ ] Первый бэкап сделан, restore-check — OK.
- [ ] Письмо о тестовой заявке пришло. Это после SMTP и включения форм. Формы включают так:
  1. `SITE_LEADS_ENABLED=true` в `/etc/soltex/soltex.env`;
  2. перезапустить службы;
  3. опубликовать новый релиз.
- [ ] У всех пользователей включён второй фактор. Временные пароли сменены.
- [ ] «Система» в админке: база, worker и диск — зелёные.
- [ ] Sitemap отправлен в Search Console.
