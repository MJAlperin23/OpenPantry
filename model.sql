

CREATE TABLE MessengerUsers (
  id bigint UNIQUE NOT NULL,
  date_created TIMESTAMP
);

CREATE TABLE PantryItems (
  id serial PRIMARY KEY,
  user_id bigint REFERENCES messengerusers(id),
  item_name VARCHAR(60) UNIQUE
);

CREATE TABLE AllergyItems (
  id serial PRIMARY KEY,
  user_id bigint REFERENCES messengerusers(id),
  item_name VARCHAR(60) UNIQUE
);


/*

INSERT INTO messengerusers (id, name) VALUES
    (10001, 'Joe'),
    (10003, 'Bob');

*/\

-- DELETE FROM PantryItems WHERE item_name IN ('Pie, ')
