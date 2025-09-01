-- Add sessions for September 2025 (8 sessions)
INSERT INTO sessions (user_id, organization_id, lead_id, project_id, session_date, session_time, location, notes, status) VALUES
-- September 2025 sessions (using actual user_id from existing leads)
((SELECT DISTINCT user_id FROM leads LIMIT 1), '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45', '06a69dd4-8625-4825-bf7e-8afbffe4a381', '0ae111d2-8f20-455c-9883-b01f177e257c', '2025-09-05', '10:00', 'Downtown Studio', 'Corporate headshot session', 'planned'),
((SELECT DISTINCT user_id FROM leads LIMIT 1), '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45', 'ee37ef3b-b6a5-47c1-b967-58d3ac2ddb8b', 'c2597804-b633-4ebe-85fa-67931124710a', '2025-09-08', '14:00', 'Client Home', 'Newborn photography session', 'planned'),
((SELECT DISTINCT user_id FROM leads LIMIT 1), '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45', '387a3eba-3c4d-4f1b-91c4-5222c10f01fa', '946c825c-25b6-4aca-bde3-64afb03c80dc', '2025-09-12', '16:30', 'Church of St. Mary', 'Wedding ceremony coverage', 'planned'),
((SELECT DISTINCT user_id FROM leads LIMIT 1), '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45', '037778da-62af-4e67-a915-fc5d8bb573f7', NULL, '2025-09-15', '11:00', 'Central Park', 'Family portrait session', 'planned'),
((SELECT DISTINCT user_id FROM leads LIMIT 1), '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45', '002fa2ac-08d0-4483-a9ba-0d03837e02e3', NULL, '2025-09-18', '09:30', 'Beach Location', 'Maternity photoshoot', 'planned'),
((SELECT DISTINCT user_id FROM leads LIMIT 1), '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45', '06a69dd4-8625-4825-bf7e-8afbffe4a381', NULL, '2025-09-22', '13:00', 'Studio B', 'Portrait session follow-up', 'planned'),
((SELECT DISTINCT user_id FROM leads LIMIT 1), '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45', 'ee37ef3b-b6a5-47c1-b967-58d3ac2ddb8b', NULL, '2025-09-25', '15:30', 'Outdoor Garden', 'Children portrait session', 'planned'),
((SELECT DISTINCT user_id FROM leads LIMIT 1), '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45', '387a3eba-3c4d-4f1b-91c4-5222c10f01fa', NULL, '2025-09-28', '12:00', 'Event Hall', 'Engagement session', 'planned'),

-- October 2025 sessions  
((SELECT DISTINCT user_id FROM leads LIMIT 1), '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45', '037778da-62af-4e67-a915-fc5d8bb573f7', '0ae111d2-8f20-455c-9883-b01f177e257c', '2025-10-03', '10:30', 'Corporate Office', 'Team headshots session', 'planned'),
((SELECT DISTINCT user_id FROM leads LIMIT 1), '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45', '002fa2ac-08d0-4483-a9ba-0d03837e02e3', 'c2597804-b633-4ebe-85fa-67931124710a', '2025-10-07', '14:30', 'Home Studio Setup', 'Baby milestone session', 'planned'),
((SELECT DISTINCT user_id FROM leads LIMIT 1), '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45', '06a69dd4-8625-4825-bf7e-8afbffe4a381', '946c825c-25b6-4aca-bde3-64afb03c80dc', '2025-10-11', '17:00', 'Sunset Beach', 'Couple anniversary session', 'planned'),
((SELECT DISTINCT user_id FROM leads LIMIT 1), '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45', 'ee37ef3b-b6a5-47c1-b967-58d3ac2ddb8b', NULL, '2025-10-14', '11:30', 'City Park', 'Fashion portrait shoot', 'planned'),
((SELECT DISTINCT user_id FROM leads LIMIT 1), '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45', '387a3eba-3c4d-4f1b-91c4-5222c10f01fa', NULL, '2025-10-18', '09:00', 'Historic District', 'Lifestyle session', 'planned'),
((SELECT DISTINCT user_id FROM leads LIMIT 1), '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45', '037778da-62af-4e67-a915-fc5d8bb573f7', NULL, '2025-10-22', '13:30', 'Rooftop Studio', 'Creative portrait session', 'planned'),
((SELECT DISTINCT user_id FROM leads LIMIT 1), '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45', '002fa2ac-08d0-4483-a9ba-0d03837e02e3', NULL, '2025-10-25', '16:00', 'Nature Reserve', 'Outdoor family shoot', 'planned'),
((SELECT DISTINCT user_id FROM leads LIMIT 1), '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45', '06a69dd4-8625-4825-bf7e-8afbffe4a381', NULL, '2025-10-29', '12:30', 'Downtown Loft', 'Business portrait session', 'planned');

-- Add reminders for September 2025 (8 reminders)  
INSERT INTO activities (user_id, organization_id, lead_id, project_id, type, content, reminder_date, reminder_time) VALUES
-- September 2025 reminders
((SELECT DISTINCT user_id FROM leads LIMIT 1), '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45', '06a69dd4-8625-4825-bf7e-8afbffe4a381', '0ae111d2-8f20-455c-9883-b01f177e257c', 'reminder', 'Prepare equipment for corporate headshot session', '2025-09-04', '09:00'),
((SELECT DISTINCT user_id FROM leads LIMIT 1), '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45', 'ee37ef3b-b6a5-47c1-b967-58d3ac2ddb8b', 'c2597804-b633-4ebe-85fa-67931124710a', 'reminder', 'Call client to confirm newborn session details', '2025-09-07', '10:00'), 
((SELECT DISTINCT user_id FROM leads LIMIT 1), '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45', '387a3eba-3c4d-4f1b-91c4-5222c10f01fa', '946c825c-25b6-4aca-bde3-64afb03c80dc', 'reminder', 'Scout wedding venue and check lighting', '2025-09-10', '14:00'),
((SELECT DISTINCT user_id FROM leads LIMIT 1), '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45', '037778da-62af-4e67-a915-fc5d8bb573f7', NULL, 'reminder', 'Send family session preparation guide', '2025-09-13', '11:00'),
((SELECT DISTINCT user_id FROM leads LIMIT 1), '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45', '002fa2ac-08d0-4483-a9ba-0d03837e02e3', NULL, 'reminder', 'Review maternity pose references', '2025-09-17', '15:30'),
((SELECT DISTINCT user_id FROM leads LIMIT 1), '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45', '06a69dd4-8625-4825-bf7e-8afbffe4a381', NULL, 'reminder', 'Follow up on payment for portrait session', '2025-09-20', '09:30'),
((SELECT DISTINCT user_id FROM leads LIMIT 1), '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45', 'ee37ef3b-b6a5-47c1-b967-58d3ac2ddb8b', NULL, 'reminder', 'Confirm outdoor location backup plan', '2025-09-24', '12:00'),
((SELECT DISTINCT user_id FROM leads LIMIT 1), '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45', '387a3eba-3c4d-4f1b-91c4-5222c10f01fa', NULL, 'reminder', 'Prepare engagement session shot list', '2025-09-27', '16:00'),

-- October 2025 reminders
((SELECT DISTINCT user_id FROM leads LIMIT 1), '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45', '037778da-62af-4e67-a915-fc5d8bb573f7', '0ae111d2-8f20-455c-9883-b01f177e257c', 'reminder', 'Coordinate team headshot scheduling', '2025-10-02', '08:30'),
((SELECT DISTINCT user_id FROM leads LIMIT 1), '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45', '002fa2ac-08d0-4483-a9ba-0d03837e02e3', 'c2597804-b633-4ebe-85fa-67931124710a', 'reminder', 'Order baby milestone props', '2025-10-05', '13:00'),
((SELECT DISTINCT user_id FROM leads LIMIT 1), '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45', '06a69dd4-8625-4825-bf7e-8afbffe4a381', '946c825c-25b6-4aca-bde3-64afb03c80dc', 'reminder', 'Check sunset timing for beach session', '2025-10-10', '11:00'),
((SELECT DISTINCT user_id FROM leads LIMIT 1), '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45', 'ee37ef3b-b6a5-47c1-b967-58d3ac2ddb8b', NULL, 'reminder', 'Prepare fashion photography lighting setup', '2025-10-13', '10:30'),
((SELECT DISTINCT user_id FROM leads LIMIT 1), '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45', '387a3eba-3c4d-4f1b-91c4-5222c10f01fa', NULL, 'reminder', 'Research historic district photo permits', '2025-10-16', '14:30'),
((SELECT DISTINCT user_id FROM leads LIMIT 1), '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45', '037778da-62af-4e67-a915-fc5d8bb573f7', NULL, 'reminder', 'Test creative lighting concepts', '2025-10-21', '09:00'),
((SELECT DISTINCT user_id FROM leads LIMIT 1), '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45', '002fa2ac-08d0-4483-a9ba-0d03837e02e3', NULL, 'reminder', 'Send client wardrobe suggestions', '2025-10-24', '15:00'),
((SELECT DISTINCT user_id FROM leads LIMIT 1), '9c3e5bce-d804-4d1c-9d13-04c42d7d1f45', '06a69dd4-8625-4825-bf7e-8afbffe4a381', NULL, 'reminder', 'Finalize business portrait session details', '2025-10-28', '11:30');