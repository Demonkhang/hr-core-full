import asyncio
import httpx

async def test_live_server():
    async with httpx.AsyncClient() as client:
        # Test auth login first or get token
        login_res = await client.post("http://localhost:8001/api/v1/auth/login", json={"username": "admin@example.com", "password": "password123"})
        if login_res.status_code != 200:
            print("Login status code:", login_res.status_code)
            token = ""
        else:
            token = login_res.json().get("access_token")
            print("Login success, token acquired!")

        headers = {"Authorization": f"Bearer {token}"} if token else {}
        shift_res = await client.get("http://localhost:8001/api/v1/shift-rate-configs", headers=headers)
        print("GET /shift-rate-configs Status:", shift_res.status_code)
        if shift_res.status_code != 200:
            print("Response Code:", shift_res.status_code)
        else:
            print("Rows returned:", len(shift_res.json()))

if __name__ == "__main__":
    asyncio.run(test_live_server())

