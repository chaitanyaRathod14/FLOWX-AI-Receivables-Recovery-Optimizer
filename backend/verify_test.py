import requests

response = requests.post(
    "http://127.0.0.1:8000/auth/login",
    json={"email": "orion@gmail.com", "password": "12345678"}
)

print("Status Code:", response.status_code)
print("Response Body:", response.text)