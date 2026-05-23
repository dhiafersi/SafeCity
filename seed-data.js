const { execSync } = require('child_process');

console.log('Starting SafeCity seed process for Bizerte and Zarzouna...');

// 1. Log in to Keycloak CLI inside container
try {
  console.log('Logging in to Keycloak Admin CLI...');
  execSync(
    'docker exec safecity-keycloak /opt/keycloak/bin/kcadm.sh config credentials --server http://localhost:8080 --realm master --user admin --password admin',
    { stdio: 'inherit' }
  );
} catch (err) {
  console.error('Failed to log in to Keycloak Admin CLI:', err.message);
  process.exit(1);
}

// Define the mock users
const users = [
  { username: 'citizen_bizerte1', email: 'citizen_bizerte1@safecity.local', firstName: 'Aymen', lastName: 'Bizerte' },
  { username: 'citizen_bizerte2', email: 'citizen_bizerte2@safecity.local', firstName: 'Rania', lastName: 'Bizerte' },
  { username: 'citizen_zarzouna1', email: 'citizen_zarzouna1@safecity.local', firstName: 'Sami', lastName: 'Zarzouna' },
  { username: 'citizen_zarzouna2', email: 'citizen_zarzouna2@safecity.local', firstName: 'Meriam', lastName: 'Zarzouna' }
];

// Helper to query postgres
function queryPostgres(sql) {
  try {
    const output = execSync(
      `docker exec -i safecity-postgres psql -U safecity_user -d safecity_db -t -A`,
      { input: sql, encoding: 'utf8' }
    );
    return output.trim();
  } catch (err) {
    console.error(`PostgreSQL query failed for SQL: ${sql}`);
    console.error(err.message);
    throw err;
  }
}

// 2. Create users in Keycloak if they do not exist
const userUuids = {};
for (const u of users) {
  console.log(`Checking if user ${u.username} exists in Keycloak database...`);
  const existingId = queryPostgres(`SELECT id FROM keycloak.user_entity WHERE username = '${u.username}'`);
  
  if (existingId) {
    console.log(`User ${u.username} already exists with ID: ${existingId}`);
    userUuids[u.username] = existingId;
  } else {
    console.log(`Creating user ${u.username} in Keycloak...`);
    try {
      execSync(
        `docker exec safecity-keycloak /opt/keycloak/bin/kcadm.sh create users -r safecity -s username=${u.username} -s enabled=true -s email=${u.email} -s firstName="${u.firstName}" -s lastName="${u.lastName}"`,
        { stdio: 'inherit' }
      );
      execSync(
        `docker exec safecity-keycloak /opt/keycloak/bin/kcadm.sh set-password -r safecity --username ${u.username} --new-password citizen123`,
        { stdio: 'inherit' }
      );
      execSync(
        `docker exec safecity-keycloak /opt/keycloak/bin/kcadm.sh add-roles -r safecity --uusername ${u.username} --rolename CITIZEN`,
        { stdio: 'inherit' }
      );
      
      const newId = queryPostgres(`SELECT id FROM keycloak.user_entity WHERE username = '${u.username}'`);
      console.log(`Successfully created user ${u.username} with ID: ${newId}`);
      userUuids[u.username] = newId;
    } catch (err) {
      console.error(`Failed to create or configure user ${u.username}:`, err.message);
      process.exit(1);
    }
  }
}

console.log('All Keycloak users validated.');

// Clean up previous mock data to avoid duplication on repeated runs
console.log('Cleaning up existing mock data from database...');
queryPostgres(`
  DELETE FROM incident_comments WHERE author_username IN ('citizen_bizerte1', 'citizen_bizerte2', 'citizen_zarzouna1', 'citizen_zarzouna2');
  DELETE FROM incident_audit_logs WHERE actor_username IN ('citizen_bizerte1', 'citizen_bizerte2', 'citizen_zarzouna1', 'citizen_zarzouna2') 
     OR incident_id IN (SELECT id FROM incidents WHERE reporter_username IN ('citizen_bizerte1', 'citizen_bizerte2', 'citizen_zarzouna1', 'citizen_zarzouna2'));
  DELETE FROM incidents WHERE reporter_username IN ('citizen_bizerte1', 'citizen_bizerte2', 'citizen_zarzouna1', 'citizen_zarzouna2');
  DELETE FROM citizen_points WHERE citizen_username IN ('citizen_bizerte1', 'citizen_bizerte2', 'citizen_zarzouna1', 'citizen_zarzouna2');
`);

console.log('Database cleanup completed.');

const incidentsData = [
  // Bizerte Center
  {
    title: 'Large Pothole near Vieux Port',
    description: 'A deep pothole in the middle of the road near the old port. Extremely dangerous for motorists and cyclists.',
    category: 'POTHOLE',
    status: 'RESOLVED',
    latitude: 37.2764,
    longitude: 9.8732,
    address: 'Vieux Port, Bizerte Center',
    reporter: 'citizen_bizerte1',
    createdAtOffset: '10 days',
    validatedAtOffset: '9 days',
    assignedDepartment: 'Roads',
    departmentAssignedAtOffset: '8 days',
    departmentFixPhotoPath: 'f440cfcc-dfe8-46b7-9d35-2dd71b7a2ce8_MicrosoftTeams-image_32.jpg',
    departmentFixSubmittedAtOffset: '7 days',
    resolvedAtOffset: '6 days',
    photoPath: 'fae3d455-2958-442d-99dc-c34e59f6a5eb_images.jpeg',
    citizenRating: 5,
    ratedAtOffset: '5 days',
    comments: [
      { author: 'roads1', role: 'DEPARTMENT', body: 'The team has filled the pothole with hot asphalt and compacted it.' },
      { author: 'citizen_bizerte1', role: 'CITIZEN', body: 'Thank you! Perfect repair.' }
    ]
  },
  {
    title: 'Broken Streetlight on Avenue Hédi Chaker',
    description: 'Streetlight is completely out, leaving the sidewalk in pitch black during the night.',
    category: 'BROKEN_STREETLIGHT',
    status: 'ASSIGNED',
    latitude: 37.2721,
    longitude: 9.8710,
    address: 'Avenue Hédi Chaker, Bizerte Center',
    reporter: 'citizen_bizerte1',
    createdAtOffset: '3 days',
    validatedAtOffset: '2 days',
    assignedDepartment: 'Lighting',
    departmentAssignedAtOffset: '2 days',
    photoPath: '0e1423f9-5932-4769-9ecc-4828851e4012_téléchargement (2).jpeg'
  },
  {
    title: 'Water Leak near Bizerte Bridge',
    description: 'Water is gushing out of the pavement near the bridge entry. Looks like a burst water pipe.',
    category: 'WATER_LEAK',
    status: 'FIX_SUBMITTED',
    latitude: 37.2690,
    longitude: 9.8805,
    address: 'Pont de Bizerte, Bizerte',
    reporter: 'citizen_bizerte2',
    createdAtOffset: '4 days',
    validatedAtOffset: '3 days',
    assignedDepartment: 'Roads',
    departmentAssignedAtOffset: '3 days',
    departmentFixPhotoPath: 'e1d932ba-cd76-466f-96eb-8c65c2a03338_téléchargement (2).jpeg',
    departmentFixSubmittedAtOffset: '1 days',
    photoPath: 'e1d932ba-cd76-466f-96eb-8c65c2a03338_téléchargement (2).jpeg'
  },
  {
    title: 'Illegal Waste Dumping near Corniche',
    description: 'Someone dumped construction waste and old furniture on the side of the Corniche road.',
    category: 'ILLEGAL_DUMPING',
    status: 'PENDING',
    latitude: 37.2842,
    longitude: 9.8655,
    address: 'Corniche Road, Bizerte',
    reporter: 'citizen_bizerte2',
    createdAtOffset: '1 days',
    photoPath: 'fae3d455-2958-442d-99dc-c34e59f6a5eb_images.jpeg'
  },
  {
    title: 'Damaged Speed Limit Sign',
    description: 'Speed limit sign is bent and facing the wrong direction, confusing drivers.',
    category: 'DAMAGED_SIGN',
    status: 'VALIDATED',
    latitude: 37.2785,
    longitude: 9.8780,
    address: 'Avenue de l\'Algérie, Bizerte',
    reporter: 'citizen_bizerte1',
    createdAtOffset: '5 days',
    validatedAtOffset: '4 days',
    photoPath: null
  },
  {
    title: 'Flooding on Avenue Hassan Nouri',
    description: 'Big puddle of stagnant water after the light rain. The drainage system seems blocked.',
    category: 'FLOODING',
    status: 'PENDING',
    latitude: 37.2705,
    longitude: 9.8690,
    address: 'Avenue Hassan Nouri, Bizerte',
    reporter: 'citizen_bizerte2',
    createdAtOffset: '6 hours',
    photoPath: null
  },
  {
    title: 'Graffiti on Historical Wall',
    description: 'Offensive graffiti sprayed on the side of the Spanish Fort ramparts.',
    category: 'GRAFFITI',
    status: 'REJECTED',
    latitude: 37.2755,
    longitude: 9.8720,
    address: 'Fort d\'Espagne, Bizerte',
    reporter: 'citizen_bizerte1',
    createdAtOffset: '8 days',
    rejectionReason: 'Historical monument graffiti requires special conservation request, transferred to Ministry of Culture.',
    photoPath: '0e1423f9-5932-4769-9ecc-4828851e4012_téléchargement (2).jpeg'
  },
  {
    title: 'Blocked Sewer Drain near Spanish Fort',
    description: 'The drain is blocked by mud and leaves, causing dirty water to spill on the sidewalk.',
    category: 'WATER_LEAK',
    status: 'RESOLVED',
    latitude: 37.2798,
    longitude: 9.8631,
    address: 'Rue d\'Espagne, Bizerte',
    reporter: 'citizen_bizerte1',
    createdAtOffset: '12 days',
    validatedAtOffset: '11 days',
    assignedDepartment: 'Roads',
    departmentAssignedAtOffset: '11 days',
    resolvedAtOffset: '9 days',
    photoPath: null,
    citizenRating: 4,
    ratedAtOffset: '8 days'
  },

  // Zarzouna
  {
    title: 'Damaged Streetlight near Zarzouna Campus',
    description: 'The streetlight fixture is dangling dangerously and could fall on students passing by.',
    category: 'BROKEN_STREETLIGHT',
    status: 'RESOLVED',
    latitude: 37.2612,
    longitude: 9.8945,
    address: 'Campus Universitaire, Zarzouna',
    reporter: 'citizen_zarzouna1',
    createdAtOffset: '14 days',
    validatedAtOffset: '13 days',
    assignedDepartment: 'Lighting',
    departmentAssignedAtOffset: '13 days',
    resolvedAtOffset: '11 days',
    photoPath: '0e1423f9-5932-4769-9ecc-4828851e4012_téléchargement (2).jpeg',
    citizenRating: 4,
    ratedAtOffset: '10 days',
    comments: [
      { author: 'lighting1', role: 'DEPARTMENT', body: 'The dangling fixture has been replaced with a new LED light and secured.' }
    ]
  },
  {
    title: 'Severe Road Cracks near Canal Bridge',
    description: 'Deep cracks on the asphalt right at the exit of the bridge, causing cars to swerve.',
    category: 'POTHOLE',
    status: 'ASSIGNED',
    latitude: 37.2645,
    longitude: 9.8875,
    address: 'Zarzouna Bridge Exit, Zarzouna',
    reporter: 'citizen_zarzouna1',
    createdAtOffset: '2 days',
    validatedAtOffset: '1 days',
    assignedDepartment: 'Roads',
    departmentAssignedAtOffset: '1 days',
    photoPath: 'f440cfcc-dfe8-46b7-9d35-2dd71b7a2ce8_MicrosoftTeams-image_32.jpg'
  },
  {
    title: 'Overflowing Garbage Container',
    description: 'The garbage container is full and bags are piled up on the street, attracting stray animals.',
    category: 'ILLEGAL_DUMPING',
    status: 'PENDING',
    latitude: 37.2580,
    longitude: 9.8920,
    address: 'Rue Habib Bourguiba, Zarzouna',
    reporter: 'citizen_zarzouna2',
    createdAtOffset: '8 hours',
    photoPath: 'fae3d455-2958-442d-99dc-c34e59f6a5eb_images.jpeg'
  },
  {
    title: 'Water Main Burst on Rue Habib Bourguiba',
    description: 'A huge volume of water is flowing into the street, flooding the entrance of nearby shops.',
    category: 'WATER_LEAK',
    status: 'VALIDATED',
    latitude: 37.2628,
    longitude: 9.8890,
    address: 'Rue Habib Bourguiba, Zarzouna Center',
    reporter: 'citizen_zarzouna2',
    createdAtOffset: '1 days',
    validatedAtOffset: '18 hours',
    photoPath: null
  },
  {
    title: 'Broken Traffic Sign near Zarzouna Mosque',
    description: 'The stop sign has been hit by a vehicle and is now lying on the pavement.',
    category: 'DAMAGED_SIGN',
    status: 'PENDING',
    latitude: 37.2595,
    longitude: 9.8995,
    address: 'Zarzouna Mosque Square, Zarzouna',
    reporter: 'citizen_zarzouna1',
    createdAtOffset: '1 days',
    photoPath: null
  },
  {
    title: 'Overgrown Tree Blocking Streetlight',
    description: 'Tree branches have completely covered the streetlight, causing dark spots on the road.',
    category: 'BROKEN_STREETLIGHT',
    status: 'VALIDATED',
    latitude: 37.2555,
    longitude: 9.9020,
    address: 'Zarzouna East Road, Zarzouna',
    reporter: 'citizen_zarzouna2',
    createdAtOffset: '3 days',
    validatedAtOffset: '2 days',
    photoPath: null
  },
  {
    title: 'Pothole on Boulevard de l\'Environnement',
    description: 'Small but deep pothole causing suspension damage to passing vehicles.',
    category: 'POTHOLE',
    status: 'RESOLVED',
    latitude: 37.2568,
    longitude: 9.8962,
    address: 'Boulevard de l\'Environnement, Zarzouna',
    reporter: 'citizen_zarzouna1',
    createdAtOffset: '15 days',
    validatedAtOffset: '14 days',
    assignedDepartment: 'Roads',
    departmentAssignedAtOffset: '13 days',
    resolvedAtOffset: '10 days',
    photoPath: 'f440cfcc-dfe8-46b7-9d35-2dd71b7a2ce8_MicrosoftTeams-image_32.jpg',
    citizenRating: 5,
    ratedAtOffset: '9 days'
  },
  {
    title: 'Littering in Public Park Zarzouna',
    description: 'Lots of plastic bags and bottles scattered on the lawns after the weekend picnic.',
    category: 'ILLEGAL_DUMPING',
    status: 'REJECTED',
    latitude: 37.2605,
    longitude: 9.8960,
    address: 'Zarzouna Public Park, Zarzouna',
    reporter: 'citizen_zarzouna2',
    createdAtOffset: '5 days',
    rejectionReason: 'Duplicate of existing cleanup request',
    photoPath: null
  }
];

const citizenPointsMap = {}; // Tracks impact points dynamically to insert at the end

// Log actions helper
function createAuditLog(incidentId, actionType, oldValue, newValue, actorUsername, note) {
  const actorId = actorUsername === 'admin1' ? '98c171e3-38e1-4074-884c-2e10a3b52b08' : (userUuids[actorUsername] || '');
  queryPostgres(`
    INSERT INTO incident_audit_logs (action_type, actor_keycloak_id, actor_username, created_at, incident_id, old_value, new_value, note)
    VALUES ('${actionType}', '${actorId}', '${actorUsername}', NOW(), ${incidentId}, ${oldValue ? `'${oldValue}'` : 'NULL'}, ${newValue ? `'${newValue}'` : 'NULL'}, ${note ? `'${note}'` : 'NULL'})
  `);
}

// Main insertion loop
console.log('Inserting mock incidents...');
for (const inc of incidentsData) {
  const reporterUuid = userUuids[inc.reporter];
  const reporterEmail = `${inc.reporter}@safecity.local`;

  // Build timestamps using offset
  const createdAtExpr = `NOW() - INTERVAL '${inc.createdAtOffset}'`;
  const updatedAtExpr = `NOW() - INTERVAL '${inc.createdAtOffset}'`;
  const validatedAtExpr = inc.validatedAtOffset ? `NOW() - INTERVAL '${inc.validatedAtOffset}'` : 'NULL';
  const resolvedAtExpr = inc.resolvedAtOffset ? `NOW() - INTERVAL '${inc.resolvedAtOffset}'` : 'NULL';
  const ratedAtExpr = inc.ratedAtOffset ? `NOW() - INTERVAL '${inc.ratedAtOffset}'` : 'NULL';
  const depAssignedAtExpr = inc.departmentAssignedAtOffset ? `NOW() - INTERVAL '${inc.departmentAssignedAtOffset}'` : 'NULL';
  const depFixSubmittedAtExpr = inc.departmentFixSubmittedAtOffset ? `NOW() - INTERVAL '${inc.departmentFixSubmittedAtOffset}'` : 'NULL';
  
  // Set 72 hours SLA if validated
  const slaDeadlineAtExpr = inc.validatedAtOffset ? `NOW() - INTERVAL '${inc.validatedAtOffset}' + INTERVAL '72 hours'` : 'NULL';

  const insertSql = `
    INSERT INTO incidents (
      title, description, category, status, latitude, longitude, address,
      reporter_keycloak_id, reporter_username, reporter_email,
      created_at, updated_at, validated_at, resolved_at,
      assigned_department, department_assigned_at,
      photo_path, department_fix_photo_path, department_fix_submitted_at,
      rejection_reason, citizen_rating, rated_at, sla_deadline_at
    ) VALUES (
      '${inc.title.replace(/'/g, "''")}',
      '${inc.description.replace(/'/g, "''")}',
      '${inc.category}',
      '${inc.status}',
      ${inc.latitude},
      ${inc.longitude},
      '${inc.address.replace(/'/g, "''")}',
      '${reporterUuid}',
      '${inc.reporter}',
      '${reporterEmail}',
      ${createdAtExpr},
      ${updatedAtExpr},
      ${validatedAtExpr},
      ${resolvedAtExpr},
      ${inc.assignedDepartment ? `'${inc.assignedDepartment}'` : 'NULL'},
      ${depAssignedAtExpr},
      ${inc.photoPath ? `'${inc.photoPath}'` : 'NULL'},
      ${inc.departmentFixPhotoPath ? `'${inc.departmentFixPhotoPath}'` : 'NULL'},
      ${depFixSubmittedAtExpr},
      ${inc.rejectionReason ? `'${inc.rejectionReason.replace(/'/g, "''")}'` : 'NULL'},
      ${inc.citizenRating || 'NULL'},
      ${ratedAtExpr},
      ${slaDeadlineAtExpr}
    ) RETURNING id;
  `;

  const incidentIdStr = queryPostgres(insertSql);
  const incidentId = parseInt(incidentIdStr, 10);
  console.log(`Inserted incident: "${inc.title}" (ID: ${incidentId})`);

  // Track points if validated or resolved (10 points for reporting, 10 for validation/resolution)
  if (inc.status !== 'PENDING' && inc.status !== 'REJECTED') {
    citizenPointsMap[inc.reporter] = (citizenPointsMap[inc.reporter] || 0) + 20;
  }

  // Create Audit Logs
  createAuditLog(incidentId, 'CREATED', null, 'PENDING', inc.reporter, 'Incident reported via mobile app');
  
  if (inc.status === 'REJECTED') {
    createAuditLog(incidentId, 'REJECTED', 'PENDING', 'REJECTED', 'admin1', inc.rejectionReason);
  } else if (inc.status !== 'PENDING') {
    createAuditLog(incidentId, 'STATUS_CHANGED', 'PENDING', 'VALIDATED', 'admin1', 'Incident validated by admin');
    createAuditLog(incidentId, 'SLA_SET', null, '72h', 'admin1', 'SLA limit set to 72 hours');

    if (inc.assignedDepartment) {
      createAuditLog(incidentId, 'ASSIGNED', 'VALIDATED', 'ASSIGNED', 'admin1', `Assigned to ${inc.assignedDepartment} Department`);
    }

    if (inc.status === 'FIX_SUBMITTED' || inc.status === 'RESOLVED') {
      const depUsername = inc.assignedDepartment === 'Roads' ? 'roads1' : 'lighting1';
      createAuditLog(incidentId, 'FIX_SUBMITTED', 'ASSIGNED', 'FIX_SUBMITTED', depUsername, 'Proof of repair photo uploaded');
    }

    if (inc.status === 'RESOLVED') {
      createAuditLog(incidentId, 'FIX_APPROVED', 'FIX_SUBMITTED', 'RESOLVED', 'admin1', 'Repair proof verified and approved');
      
      if (inc.citizenRating) {
        createAuditLog(incidentId, 'RATED', null, inc.citizenRating.toString(), inc.reporter, 'Citizen satisfaction survey submitted');
      }
    }
  }

  // Insert Comments if any
  if (inc.comments) {
    for (const c of inc.comments) {
      const authorUuid = c.author === 'roads1' ? '525b1ee6-20f5-42e3-a055-ef7c4c593fb4' : (userUuids[c.author] || '');
      queryPostgres(`
        INSERT INTO incident_comments (author_keycloak_id, author_role, author_username, body, created_at, incident_id)
        VALUES ('${authorUuid}', '${c.role}', '${c.author}', '${c.body.replace(/'/g, "''")}', NOW(), ${incidentId})
      `);
      createAuditLog(incidentId, 'COMMENT_ADDED', null, null, c.author, `Comment left by ${c.author}`);
    }
  }
}

// 4. Insert citizen points to reward reporters
console.log('Updating citizen points/leaderboard...');
for (const [username, points] of Object.entries(citizenPointsMap)) {
  const uuid = userUuids[username];
  queryPostgres(`
    INSERT INTO citizen_points (citizen_keycloak_id, citizen_username, total_points, created_at, updated_at)
    VALUES ('${uuid}', '${username}', ${points}, NOW(), NOW())
  `);
  console.log(`User ${username} awarded ${points} points.`);
}

console.log('SafeCity seed completed successfully!');
