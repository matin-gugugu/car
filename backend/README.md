# Flask Backend

This backend serves the React app's API under the `/api` prefix and uses SQLite for data storage.

## Setup

```bash
python3 -m venv backend/.venv
source backend/.venv/bin/activate
pip install -r requirements.txt
python app.py
```

The server runs on `http://localhost:5001`.

## Endpoints

- GET `/api/home/getData`
- GET `/api/user/getUser?keyword=...` (or `name=...`)
- POST `/api/echo`
- GET `/api/rental-orders?plate=...&driverName=...`
- POST `/api/rental-orders`
- PUT `/api/rental-orders/<id>`
- DELETE `/api/rental-orders/<id>`
- GET `/api/vehicles?plate=...&carType=...&isRented=0|1`
- POST `/api/vehicles`
- PUT `/api/vehicles/<id>`
- DELETE `/api/vehicles/<id>`

## Notes

- SQLite file: `backend/app.db`
- Seed data is inserted on first run.
