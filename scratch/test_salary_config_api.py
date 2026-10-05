import asyncio
import httpx
import json

async def test_endpoint():
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get("http://localhost:8001/api/v1/salary-config/public-sector-active")
            print("Status Code:", res.status_code)
            print("Response Keys:", list(res.json().keys()))
            print("Base Salary:", res.json().get("base_salary"))
            print("Shift Rates Count:", len(res.json().get("shift_rates", [])))
        except Exception as e:
            print("Error connecting:", e)

if __name__ == "__main__":
    asyncio.run(test_endpoint())

