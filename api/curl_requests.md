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
python manage.py shell -c "
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

## Curl commands
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

### Active user profile
```bash
curl -s http://localhost:8000/api/accounts/me/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" | python -m json.tool
```
###

### Delete a user
```bash
curl -s -X DELETE http://localhost:8000/api/accounts/id/ \
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