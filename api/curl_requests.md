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
###