from app import database
from sqlalchemy import text

db = next(database.get_db())
print('roles count:')
for r in db.execute(text("select r.role_name, count(*) from users u join roles r on u.role_id = r.role_id group by r.role_name order by r.role_name")):
    print(r)

print('\nflight_assignments:', db.execute(text('select count(*) from flight_assignments')).scalar())
print('flights total:', db.execute(text('select count(*) from flights')).scalar())
print('flights status group:')
for r in db.execute(text("select status, count(*) from flights group by status order by status")):
    print(r)

db.close()
