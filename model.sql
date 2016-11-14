

CREATE TABLE MessengerUsers (
  id bigint UNIQUE NOT NULL,
  timestamp_created BIGINT
);

CREATE TABLE PantryItems (
  id serial PRIMARY KEY,
  user_id bigint REFERENCES messengerusers(id),
  item_name VARCHAR(60)
);

CREATE TABLE AllergyItems (
  id serial PRIMARY KEY,
  user_id bigint REFERENCES messengerusers(id),
  item_name VARCHAR(60)
);


/*

INSERT INTO messengerusers (id, name) VALUES
    (10001, 'Joe'),
    (10003, 'Bob');

*/\

-- DELETE FROM PantryItems WHERE item_name IN ('Pie, ')
