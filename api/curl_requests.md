# Curl requests & python commands actions file

---

## Python commands
###

### Start the Django server
```bash
python api/manage.py runserver
```
###

### Apply changes & migrate the database
```bash
python api/manage.py makemigrations <module>
python api/manage.py migrate
```
#### Example
```bash
python api/manage.py makemigrations accounts
```
###

### Create the first admin directly in shell
```bash
python api/manage.py shell -c "
from apps.accounts.models import User
User.objects.create_user(
    email='admin@economat.sn',
    name='Admin',
    role='admin',
    password='secret123'
)"
```
###

### Reset stuck single-session locks (after an unclean shutdown)
```bash
python api/manage.py reset_sessions                 # all users
python api/manage.py reset_sessions --email admin@economat.sn
```
> Login now uses takeover semantics (newest login wins) and idle sessions free
> themselves after SESSION_IDLE_MINUTES, so this is only an escape hatch.
###

---
###

# Curl commands
###

## User Management CURL commands
###

### Login
```bash
curl -s -X POST http://localhost:8000/api/accounts/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@economat.sn","password":"secret123"}' | python -m json.tool
```
###

### List users
```bash
curl -s http://localhost:8000/api/accounts/register/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" | python -m json.tool
```
###

### Create a user
```bash
curl -s -X POST http://localhost:8000/api/accounts/register/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Marie Dupont","email":"marie@economat.sn","password":"motdepasse8","role":"econome"}' \
  | python -m json.tool
```
###

### Modify a user
```bash
curl -s -X PATCH http://localhost:8000/api/accounts/<id>/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Marie Dupont","role":"cook"}' \
  | python3 -m json.tool
```
###

### Modify a password
```bash
curl -s -X PATCH http://localhost:8000/api/accounts/<id>/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password":"newpassword123"}' \
  | python3 -m json.tool
```
###

### Active user profile
```bash
curl -s http://localhost:8000/api/accounts/me/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" | python -m json.tool
```
###

### Change own password (verifies current password)
```bash
curl -s -X POST http://localhost:8000/api/accounts/change-password/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"current_password":"secret123","new_password":"newpassword123"}' \
  | python3 -m json.tool
```
###

### Logout (clears the single active session)
```bash
curl -s -X POST http://localhost:8000/api/accounts/logout/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" | python -m json.tool
```
###

### Delete a user
```bash
curl -s -X DELETE http://localhost:8000/api/accounts/<id>/ \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```
#### Example
```bash
curl -s -X DELETE http://localhost:8000/api/accounts/2/ \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```
###

### Refresh the token
```bash
curl -s -X POST http://localhost:8000/api/accounts/token/refresh/ \
  -H "Content-Type: application/json" \
  -d '{"refresh":"<paste_the_refresh_token>"}' | python -m json.tool
```
#

---

###

## Categories Management CURL commands
###

### List all categories
```bash
curl -s http://localhost:8000/api/categories/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  | python3 -m json.tool --no-ensure-ascii
```
###

### Create a category
```bash
curl -s -X POST http://localhost:8000/api/categories/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Légumes"}' \
  | python3 -m json.tool
```
###

### Modify a category
```bash
curl -s -X PATCH http://localhost:8000/api/categories/<id>/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Légumes frais"}' \
  | python3 -m json.tool
```
###

### Delete a category
```bash
curl -s -X DELETE http://localhost:8000/api/categories/<id>/ \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```
#

---

###

## Suppliers Management CURL commands
###

### List all suppliers
```bash
curl -s http://localhost:8000/api/suppliers/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  | python3 -m json.tool --no-ensure-ascii
```
###

### Create a supplier
```bash
curl -s -X POST http://localhost:8000/api/suppliers/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Sosapen", "phone":""}' \
  | python3 -m json.tool
```
###

### Modify a supplier
```bash
curl -s -X PATCH http://localhost:8000/api/suppliers/<id>/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Sosapen","phone":"771234567","email":"contact@sosapen.sn"}' \
  | python3 -m json.tool
```
###

### Delete a supplier
```bash
curl -s -X DELETE http://localhost:8000/api/suppliers/<id>/ \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```
#

---

###

## Articles Management CURL commands
###

### List all articles
```bash
curl -s http://localhost:8000/api/articles/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  | python3 -m json.tool --no-ensure-ascii
```
###

### Create an articles
```bash
curl -s -X POST http://localhost:8000/api/articles/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Tomates","category":1,"unit":"kg","sale_price":0,"stock_quantity":0,"min_threshold":5}' \
  | python3 -m json.tool
```
###

### Modify an articles
```bash
curl -s -X PATCH http://localhost:8000/api/articles/<id>/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sale_price":1550,"stock_quantity":30}' \
  | python3 -m json.tool
```
###

### Delete an article
```bash
curl -s -X DELETE http://localhost:8000/api/articles/<id>/ \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```
#

---

###

## Batches Management CURL commands
###

### List all batches
```bash
curl -s http://localhost:8000/api/batches/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  | python3 -m json.tool --no-ensure-ascii
```
###

### Create a batch
```bash
curl -s -X POST http://localhost:8000/api/batches/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"article":3, "supplier":1, "purchase_price":1550, "expiry_date":"2026-06-15", "qr_code_path":"/qr_code/tomates/"}' \        
  | python3 -m json.tool
```
###

### Modify a batch
```bash
curl -s -X PATCH http://localhost:8000/api/batches/<id>/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"expiry_date":"2026-06-31","quantity":30}' \
  | python3 -m json.tool
```
###

### Delete a batch
```bash
curl -s -X DELETE http://localhost:8000/api/batches/<id>/ \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```
#

---

###

## Movements Management CURL commands
###

### List all Movements
```bash
curl -s http://localhost:8000/api/movements/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  | python3 -m json.tool --no-ensure-ascii
```
###

### Create a Movement
###

#### Stock Entry
```bash
curl -s -X POST http://localhost:8000/api/movements/ \     
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"article":1,"lot":1,"type":"entry","quantity":100,"motive":"Livraison semaine 24"}' \
  | python3 -m json.tool
```
###

#### Stock Exit
```bash
curl -s -X POST http://localhost:8000/api/movements/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \                                          
  -H "Content-Type: application/json" \
  -d '{"article":1,"type":"kitchen_exit","quantity":5,"motive":"Service du midi"}' \
  | python3 -m json.tool
```
###

#### Stock Filter by article
```bash
curl -s "http://localhost:8000/api/movements/?article=1" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  | python3 -m json.tool --no-ensure-ascii
```
#

---

###

## Alerts Management CURL commands
###

### List all alerts
```bash
curl -s http://localhost:8000/api/alerts/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  | python3 -m json.tool --no-ensure-ascii
```
###

### List unread alerts
```bash
curl -s "http://localhost:8000/api/alerts/?unread=true" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  | python3 -m json.tool --no-ensure-ascii
```
###

### Filter alerts by type
```bash
curl -s "http://localhost:8000/api/alerts/?type=threshold" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  | python3 -m json.tool --no-ensure-ascii
```
###

### Mark an alert as read
```bash
curl -s -X PATCH http://localhost:8000/api/alerts/<id>/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  | python3 -m json.tool

```
###

### Mark all alerts as read
```bash
curl -s -X POST http://localhost:8000/api/alerts/read-all/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  | python3 -m json.tool
```
#

---

###

## Deliveries Management CURL commands
###
> Validating a delivery is atomic: each line creates a batch + an entry movement
> (and the article if it does not exist yet), bumps the article stock, and
> re-checks thresholds. POST requires the `admin` or `econome` role.
###

### List all deliveries
```bash
curl -s http://localhost:8000/api/deliveries/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  | python3 -m json.tool --no-ensure-ascii
```
###

### Validate a delivery (existing articles)
```bash
curl -s -X POST http://localhost:8000/api/deliveries/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reference":"BL-2026-014",
    "supplier":1,
    "delivered_at":"2026-06-17",
    "lines":[
      {"article":1,"quantity":100,"lot_code":"LOT-A","expiry_date":"2026-07-30"},
      {"article":3,"quantity":40,"lot_code":"LOT-B"}
    ]
  }' \
  | python3 -m json.tool --no-ensure-ascii
```
###

### Validate a delivery (creating a new article on the fly)
```bash
curl -s -X POST http://localhost:8000/api/deliveries/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reference":"BL-2026-015",
    "supplier":1,
    "lines":[
      {"product_name":"Oignons","category":1,"unit":"kg","threshold":5,"quantity":60,"lot_code":"LOT-C"}
    ]
  }' \
  | python3 -m json.tool --no-ensure-ascii
```
#

---

###

## System CURL commands (branding + maintenance)
###

### Get the restaurant name (public, no auth)
```bash
curl -s http://localhost:8000/api/system/branding/ | python3 -m json.tool --no-ensure-ascii
# -> {"name": "...", "default_name": "Cuistock", "is_custom": false}
```
###

### Set a custom restaurant name (admin)
```bash
curl -s -X PATCH http://localhost:8000/api/system/branding/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Le Bistrot du Port"}' \
  | python3 -m json.tool --no-ensure-ascii
```
###

### Restore the default restaurant name (admin)
```bash
curl -s -X PATCH http://localhost:8000/api/system/branding/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"restore":true}' \
  | python3 -m json.tool --no-ensure-ascii
```
###

### Wipe the database, keeping admin accounts (admin)
```bash
curl -s -X POST http://localhost:8000/api/system/wipe/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  | python3 -m json.tool
# Deletes all products/lots/movements/deliveries/categories/suppliers/alerts
# and non-admin users. Admin accounts and the branding row are kept.
```
#