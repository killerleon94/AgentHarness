DELETE FROM member WHERE user_id IN (SELECT id FROM "user" WHERE role = 'admin');
