# import sqlite3
# from hashlib import pbkdf2_hmac
# import hmac

# conn = sqlite3.connect(r"app\flowx.db")
# row = conn.execute("SELECT password_hash FROM users WHERE email='orion@gmail.com'").fetchone()
# stored = row[0]
# print("Stored hash:", stored)

# salt, digest = stored.split("$")
# candidate = pbkdf2_hmac("sha256", "12345678".encode(), bytes.fromhex(salt), 120_000).hex()

# print("Match:", hmac.compare_digest(candidate, digest))


import requests

response = requests.post(
    "http://127.0.0.1:8000/auth/login",
    json={"email": "orion@gmail.com", "password": "12345678"}
)

print("Status Code:", response.status_code)
print("Response Body:", response.text)