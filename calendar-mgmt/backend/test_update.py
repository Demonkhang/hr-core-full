import asyncio
import httpx

async def test():
    async with httpx.AsyncClient() as c:
        r = await c.post("http://hr-backend:8000/api/v1/auth/login", json={"username": "admin", "password": "Admin@123"})
        token = r.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        # Create
        r = await c.post("http://localhost:8000/api/v1/leave-registrations", 
            json={"employee_id": "cdfc761a-2114-4a94-aaaa-0e46b010a4a8", "leave_type": "annual", "start_date": "2026-06-22", "end_date": "2026-06-22", "start_session": "full", "end_session": "full", "reason": "test"},
            headers=headers)
        reg_id = r.json()["id"]
        print(f"Created: {reg_id}")
        
        # Update
        r = await c.put(f"http://localhost:8000/api/v1/leave-registrations/{reg_id}",
            json={"reason": "just reason"}, headers=headers)
        print(f"Status: {r.status_code}, Body: {r.text[:500]}")
        
        # Cleanup
        await c.delete(f"http://localhost:8000/api/v1/leave-registrations/{reg_id}", headers=headers)

asyncio.run(test())
