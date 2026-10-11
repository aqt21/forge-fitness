// Exercise library + routine-generator data.
// Fields: id, name, slot, priority (lower = preferred within slot), equip (ALL required),
// muscles (primary), secondary, kind ('compound'|'isolation'), reps [min,max], bw (load is body weight; logged weight = added).
// Note: timed holds (plank, hollow hold, etc.) use reps as seconds.

export const EQUIPMENT = [
  { id: 'barbell', name: 'Barbell & plates' },
  { id: 'rack', name: 'Squat / power rack' },
  { id: 'bench', name: 'Flat bench' },
  { id: 'adj_bench', name: 'Adjustable (incline) bench' },
  { id: 'dumbbells', name: 'Dumbbells' },
  { id: 'ez_bar', name: 'EZ curl bar' },
  { id: 'kettlebell', name: 'Kettlebells' },
  { id: 'pullup_bar', name: 'Pull-up bar' },
  { id: 'dip_bars', name: 'Dip bars' },
  { id: 'cable', name: 'Cable machine / pulleys' },
  { id: 'machines', name: 'Selectorized machines (chest press, leg ext/curl, pec deck, etc.)' },
  { id: 'leg_press', name: 'Leg press' },
  { id: 'smith', name: 'Smith machine' },
  { id: 'bands', name: 'Resistance bands' },
];

export const SLOTS = ['squat','hinge','lunge','quad_iso','ham_curl','glute','calf','h_push','incline_push','v_push','chest_fly','h_pull','v_pull','rear_delt','side_delt','biceps','triceps','abs'];

export const EXERCISES = [
  // --- squat ---
  { id: 'bb_back_squat', name: 'Barbell Back Squat', slot: 'squat', priority: 1, equip: ['barbell','rack'], muscles: ['quads','glutes'], secondary: ['adductors','lower back'], kind: 'compound', reps: [5, 8], bw: false },
  { id: 'bb_front_squat', name: 'Barbell Front Squat', slot: 'squat', priority: 2, equip: ['barbell','rack'], muscles: ['quads'], secondary: ['glutes','abs','upper back'], kind: 'compound', reps: [6, 10], bw: false },
  { id: 'leg_press', name: 'Leg Press', slot: 'squat', priority: 3, equip: ['leg_press'], muscles: ['quads','glutes'], secondary: ['adductors'], kind: 'compound', reps: [8, 12], bw: false },
  { id: 'smith_squat', name: 'Smith Machine Squat', slot: 'squat', priority: 4, equip: ['smith'], muscles: ['quads','glutes'], secondary: ['adductors'], kind: 'compound', reps: [6, 10], bw: false },
  { id: 'smith_hack_squat', name: 'Smith Machine Hack Squat', slot: 'squat', priority: 5, equip: ['smith'], muscles: ['quads'], secondary: ['glutes'], kind: 'compound', reps: [8, 12], bw: false },
  { id: 'db_goblet_squat', name: 'Dumbbell Goblet Squat', slot: 'squat', priority: 6, equip: ['dumbbells'], muscles: ['quads','glutes'], secondary: ['abs','adductors'], kind: 'compound', reps: [8, 15], bw: false },
  { id: 'band_squat', name: 'Banded Squat', slot: 'squat', priority: 7, equip: ['bands'], muscles: ['quads','glutes'], secondary: ['adductors'], kind: 'compound', reps: [10, 20], bw: false },
  { id: 'bw_squat', name: 'Bodyweight Squat', slot: 'squat', priority: 8, equip: [], muscles: ['quads','glutes'], secondary: ['adductors'], kind: 'compound', reps: [12, 25], bw: true },

  // --- hinge ---
  { id: 'conventional_deadlift', name: 'Conventional Deadlift', slot: 'hinge', priority: 1, equip: ['barbell'], muscles: ['hamstrings','glutes','lower back'], secondary: ['quads','traps','forearms','lats'], kind: 'compound', reps: [3, 6], bw: false },
  { id: 'bb_rdl', name: 'Barbell Romanian Deadlift', slot: 'hinge', priority: 2, equip: ['barbell'], muscles: ['hamstrings','glutes'], secondary: ['lower back','forearms'], kind: 'compound', reps: [6, 10], bw: false },
  { id: 'sumo_deadlift', name: 'Sumo Deadlift', slot: 'hinge', priority: 3, equip: ['barbell'], muscles: ['glutes','quads','adductors'], secondary: ['hamstrings','lower back'], kind: 'compound', reps: [3, 6], bw: false },
  { id: 'good_morning', name: 'Barbell Good Morning', slot: 'hinge', priority: 4, equip: ['barbell','rack'], muscles: ['hamstrings','lower back'], secondary: ['glutes'], kind: 'compound', reps: [8, 12], bw: false },
  { id: 'db_rdl', name: 'Dumbbell Romanian Deadlift', slot: 'hinge', priority: 5, equip: ['dumbbells'], muscles: ['hamstrings','glutes'], secondary: ['lower back','forearms'], kind: 'compound', reps: [8, 12], bw: false },
  { id: 'kb_swing', name: 'Kettlebell Swing', slot: 'hinge', priority: 6, equip: ['kettlebell'], muscles: ['glutes','hamstrings'], secondary: ['lower back','abs'], kind: 'compound', reps: [10, 20], bw: false },
  { id: 'cable_pull_through', name: 'Cable Pull-Through', slot: 'hinge', priority: 7, equip: ['cable'], muscles: ['glutes','hamstrings'], secondary: ['lower back'], kind: 'compound', reps: [10, 15], bw: false },
  { id: 'db_single_leg_rdl', name: 'Dumbbell Single-Leg RDL', slot: 'hinge', priority: 8, equip: ['dumbbells'], muscles: ['hamstrings','glutes'], secondary: ['lower back','adductors'], kind: 'compound', reps: [8, 12], bw: false },
  { id: 'bw_single_leg_rdl', name: 'Bodyweight Single-Leg RDL', slot: 'hinge', priority: 9, equip: [], muscles: ['hamstrings','glutes'], secondary: ['lower back'], kind: 'compound', reps: [10, 15], bw: true },
  { id: 'superman', name: 'Superman (Back Extension on Floor)', slot: 'hinge', priority: 10, equip: [], muscles: ['lower back','glutes'], secondary: ['hamstrings'], kind: 'isolation', reps: [12, 20], bw: true },

  // --- lunge ---
  { id: 'db_bulgarian_split_squat', name: 'Dumbbell Bulgarian Split Squat', slot: 'lunge', priority: 1, equip: ['dumbbells','bench'], muscles: ['quads','glutes'], secondary: ['adductors','hamstrings'], kind: 'compound', reps: [8, 12], bw: false },
  { id: 'db_walking_lunge', name: 'Dumbbell Walking Lunge', slot: 'lunge', priority: 2, equip: ['dumbbells'], muscles: ['quads','glutes'], secondary: ['hamstrings','adductors'], kind: 'compound', reps: [10, 14], bw: false },
  { id: 'bb_lunge', name: 'Barbell Reverse Lunge', slot: 'lunge', priority: 3, equip: ['barbell','rack'], muscles: ['quads','glutes'], secondary: ['hamstrings','adductors'], kind: 'compound', reps: [6, 10], bw: false },
  { id: 'db_reverse_lunge', name: 'Dumbbell Reverse Lunge', slot: 'lunge', priority: 4, equip: ['dumbbells'], muscles: ['glutes','quads'], secondary: ['hamstrings'], kind: 'compound', reps: [8, 12], bw: false },
  { id: 'db_step_up', name: 'Dumbbell Step-Up', slot: 'lunge', priority: 5, equip: ['dumbbells','bench'], muscles: ['quads','glutes'], secondary: ['hamstrings'], kind: 'compound', reps: [8, 12], bw: false },
  { id: 'band_split_squat', name: 'Banded Split Squat', slot: 'lunge', priority: 6, equip: ['bands'], muscles: ['quads','glutes'], secondary: ['adductors'], kind: 'compound', reps: [10, 15], bw: false },
  { id: 'bw_rfe_split_squat', name: 'Rear-Foot-Elevated Split Squat (Bodyweight)', slot: 'lunge', priority: 7, equip: [], muscles: ['quads','glutes'], secondary: ['adductors','hamstrings'], kind: 'compound', reps: [10, 15], bw: true },
  { id: 'bw_reverse_lunge', name: 'Bodyweight Reverse Lunge', slot: 'lunge', priority: 8, equip: [], muscles: ['quads','glutes'], secondary: ['hamstrings'], kind: 'compound', reps: [12, 20], bw: true },

  // --- quad_iso ---
  { id: 'leg_extension', name: 'Leg Extension', slot: 'quad_iso', priority: 1, equip: ['machines'], muscles: ['quads'], secondary: [], kind: 'isolation', reps: [10, 15], bw: false },
  { id: 'smith_heel_elevated_squat', name: 'Smith Machine Heel-Elevated Squat', slot: 'quad_iso', priority: 2, equip: ['smith'], muscles: ['quads'], secondary: ['glutes'], kind: 'compound', reps: [8, 12], bw: false },
  { id: 'heel_elevated_goblet_squat', name: 'Heel-Elevated Goblet Squat', slot: 'quad_iso', priority: 3, equip: ['dumbbells'], muscles: ['quads'], secondary: ['glutes','abs'], kind: 'compound', reps: [10, 15], bw: false },
  { id: 'spanish_squat', name: 'Spanish Squat (Banded)', slot: 'quad_iso', priority: 4, equip: ['bands'], muscles: ['quads'], secondary: [], kind: 'isolation', reps: [10, 15], bw: false },
  { id: 'sissy_squat', name: 'Sissy Squat', slot: 'quad_iso', priority: 5, equip: [], muscles: ['quads'], secondary: [], kind: 'isolation', reps: [8, 15], bw: true },
  { id: 'reverse_nordic', name: 'Reverse Nordic Curl', slot: 'quad_iso', priority: 6, equip: [], muscles: ['quads'], secondary: [], kind: 'isolation', reps: [8, 15], bw: true },

  // --- ham_curl ---
  { id: 'seated_leg_curl', name: 'Seated Leg Curl', slot: 'ham_curl', priority: 1, equip: ['machines'], muscles: ['hamstrings'], secondary: ['calves'], kind: 'isolation', reps: [8, 15], bw: false },
  { id: 'lying_leg_curl', name: 'Lying Leg Curl', slot: 'ham_curl', priority: 2, equip: ['machines'], muscles: ['hamstrings'], secondary: ['calves'], kind: 'isolation', reps: [8, 15], bw: false },
  { id: 'nordic_curl', name: 'Nordic Hamstring Curl', slot: 'ham_curl', priority: 3, equip: [], muscles: ['hamstrings'], secondary: ['glutes','calves'], kind: 'isolation', reps: [5, 10], bw: true },
  { id: 'db_leg_curl', name: 'Dumbbell Leg Curl', slot: 'ham_curl', priority: 4, equip: ['dumbbells','bench'], muscles: ['hamstrings'], secondary: ['calves'], kind: 'isolation', reps: [10, 15], bw: false },
  { id: 'band_leg_curl', name: 'Banded Leg Curl', slot: 'ham_curl', priority: 5, equip: ['bands'], muscles: ['hamstrings'], secondary: ['calves'], kind: 'isolation', reps: [12, 20], bw: false },
  { id: 'sliding_leg_curl', name: 'Sliding Leg Curl', slot: 'ham_curl', priority: 6, equip: [], muscles: ['hamstrings'], secondary: ['glutes','calves'], kind: 'isolation', reps: [8, 15], bw: true },

  // --- glute ---
  { id: 'bb_hip_thrust', name: 'Barbell Hip Thrust', slot: 'glute', priority: 1, equip: ['barbell','bench'], muscles: ['glutes'], secondary: ['hamstrings','adductors'], kind: 'compound', reps: [6, 12], bw: false },
  { id: 'machine_hip_thrust', name: 'Machine Hip Thrust', slot: 'glute', priority: 2, equip: ['machines'], muscles: ['glutes'], secondary: ['hamstrings'], kind: 'compound', reps: [8, 12], bw: false },
  { id: 'db_hip_thrust', name: 'Dumbbell Hip Thrust', slot: 'glute', priority: 3, equip: ['dumbbells','bench'], muscles: ['glutes'], secondary: ['hamstrings'], kind: 'compound', reps: [10, 15], bw: false },
  { id: 'cable_kickback', name: 'Cable Glute Kickback', slot: 'glute', priority: 4, equip: ['cable'], muscles: ['glutes'], secondary: ['hamstrings'], kind: 'isolation', reps: [10, 15], bw: false },
  { id: 'band_glute_bridge', name: 'Banded Glute Bridge', slot: 'glute', priority: 5, equip: ['bands'], muscles: ['glutes'], secondary: ['hamstrings'], kind: 'compound', reps: [12, 20], bw: false },
  { id: 'glute_bridge', name: 'Glute Bridge', slot: 'glute', priority: 6, equip: [], muscles: ['glutes'], secondary: ['hamstrings'], kind: 'compound', reps: [12, 20], bw: true },
  { id: 'single_leg_glute_bridge', name: 'Single-Leg Glute Bridge', slot: 'glute', priority: 7, equip: [], muscles: ['glutes'], secondary: ['hamstrings'], kind: 'compound', reps: [10, 20], bw: true },

  // --- calf ---
  { id: 'standing_calf_raise_machine', name: 'Standing Calf Raise (Machine)', slot: 'calf', priority: 1, equip: ['machines'], muscles: ['calves'], secondary: [], kind: 'isolation', reps: [8, 15], bw: false },
  { id: 'seated_calf_raise', name: 'Seated Calf Raise', slot: 'calf', priority: 2, equip: ['machines'], muscles: ['calves'], secondary: [], kind: 'isolation', reps: [10, 20], bw: false },
  { id: 'leg_press_calf_raise', name: 'Leg Press Calf Raise', slot: 'calf', priority: 3, equip: ['leg_press'], muscles: ['calves'], secondary: [], kind: 'isolation', reps: [10, 20], bw: false },
  { id: 'smith_calf_raise', name: 'Smith Machine Calf Raise', slot: 'calf', priority: 4, equip: ['smith'], muscles: ['calves'], secondary: [], kind: 'isolation', reps: [10, 15], bw: false },
  { id: 'db_single_leg_calf_raise', name: 'Dumbbell Single-Leg Calf Raise', slot: 'calf', priority: 5, equip: ['dumbbells'], muscles: ['calves'], secondary: [], kind: 'isolation', reps: [10, 20], bw: false },
  { id: 'bw_calf_raise', name: 'Bodyweight Standing Calf Raise', slot: 'calf', priority: 6, equip: [], muscles: ['calves'], secondary: [], kind: 'isolation', reps: [15, 30], bw: true },

  // --- h_push ---
  { id: 'bb_bench_press', name: 'Barbell Bench Press', slot: 'h_push', priority: 1, equip: ['barbell','bench'], muscles: ['chest'], secondary: ['front delts','triceps'], kind: 'compound', reps: [5, 8], bw: false },
  { id: 'db_bench_press', name: 'Dumbbell Bench Press', slot: 'h_push', priority: 2, equip: ['dumbbells','bench'], muscles: ['chest'], secondary: ['front delts','triceps'], kind: 'compound', reps: [6, 10], bw: false },
  { id: 'machine_chest_press', name: 'Machine Chest Press', slot: 'h_push', priority: 3, equip: ['machines'], muscles: ['chest'], secondary: ['front delts','triceps'], kind: 'compound', reps: [8, 12], bw: false },
  { id: 'smith_bench_press', name: 'Smith Machine Bench Press', slot: 'h_push', priority: 4, equip: ['smith','bench'], muscles: ['chest'], secondary: ['front delts','triceps'], kind: 'compound', reps: [6, 10], bw: false },
  { id: 'chest_dip', name: 'Chest Dip', slot: 'h_push', priority: 5, equip: ['dip_bars'], muscles: ['chest','triceps'], secondary: ['front delts'], kind: 'compound', reps: [6, 12], bw: true },
  { id: 'cable_chest_press', name: 'Cable Chest Press', slot: 'h_push', priority: 6, equip: ['cable'], muscles: ['chest'], secondary: ['front delts','triceps'], kind: 'compound', reps: [8, 12], bw: false },
  { id: 'db_floor_press', name: 'Dumbbell Floor Press', slot: 'h_push', priority: 7, equip: ['dumbbells'], muscles: ['chest','triceps'], secondary: ['front delts'], kind: 'compound', reps: [8, 12], bw: false },
  { id: 'band_chest_press', name: 'Banded Chest Press', slot: 'h_push', priority: 8, equip: ['bands'], muscles: ['chest'], secondary: ['front delts','triceps'], kind: 'compound', reps: [10, 20], bw: false },
  { id: 'push_up', name: 'Push-Up', slot: 'h_push', priority: 9, equip: [], muscles: ['chest'], secondary: ['front delts','triceps','abs'], kind: 'compound', reps: [8, 25], bw: true },

  // --- incline_push ---
  { id: 'bb_incline_bench', name: 'Barbell Incline Bench Press', slot: 'incline_push', priority: 1, equip: ['barbell','adj_bench'], muscles: ['chest','front delts'], secondary: ['triceps'], kind: 'compound', reps: [6, 10], bw: false },
  { id: 'db_incline_press', name: 'Incline Dumbbell Press', slot: 'incline_push', priority: 2, equip: ['dumbbells','adj_bench'], muscles: ['chest','front delts'], secondary: ['triceps'], kind: 'compound', reps: [6, 12], bw: false },
  { id: 'smith_incline_press', name: 'Smith Machine Incline Press', slot: 'incline_push', priority: 3, equip: ['smith','adj_bench'], muscles: ['chest','front delts'], secondary: ['triceps'], kind: 'compound', reps: [6, 10], bw: false },
  { id: 'machine_incline_press', name: 'Machine Incline Press', slot: 'incline_push', priority: 4, equip: ['machines'], muscles: ['chest','front delts'], secondary: ['triceps'], kind: 'compound', reps: [8, 12], bw: false },
  { id: 'band_incline_press', name: 'Banded Incline Press', slot: 'incline_push', priority: 5, equip: ['bands'], muscles: ['chest','front delts'], secondary: ['triceps'], kind: 'compound', reps: [10, 20], bw: false },
  { id: 'feet_elevated_push_up', name: 'Feet-Elevated Push-Up', slot: 'incline_push', priority: 6, equip: [], muscles: ['chest','front delts'], secondary: ['triceps','abs'], kind: 'compound', reps: [8, 20], bw: true },

  // --- v_push ---
  { id: 'bb_overhead_press', name: 'Barbell Overhead Press', slot: 'v_push', priority: 1, equip: ['barbell'], muscles: ['front delts','side delts'], secondary: ['triceps','upper back'], kind: 'compound', reps: [5, 8], bw: false },
  { id: 'seated_db_shoulder_press', name: 'Seated Dumbbell Shoulder Press', slot: 'v_push', priority: 2, equip: ['dumbbells','adj_bench'], muscles: ['front delts','side delts'], secondary: ['triceps'], kind: 'compound', reps: [6, 10], bw: false },
  { id: 'machine_shoulder_press', name: 'Machine Shoulder Press', slot: 'v_push', priority: 3, equip: ['machines'], muscles: ['front delts','side delts'], secondary: ['triceps'], kind: 'compound', reps: [8, 12], bw: false },
  { id: 'smith_shoulder_press', name: 'Smith Machine Shoulder Press', slot: 'v_push', priority: 4, equip: ['smith','bench'], muscles: ['front delts','side delts'], secondary: ['triceps'], kind: 'compound', reps: [6, 10], bw: false },
  { id: 'standing_db_press', name: 'Standing Dumbbell Shoulder Press', slot: 'v_push', priority: 5, equip: ['dumbbells'], muscles: ['front delts','side delts'], secondary: ['triceps','abs'], kind: 'compound', reps: [6, 10], bw: false },
  { id: 'kb_press', name: 'Kettlebell Overhead Press', slot: 'v_push', priority: 6, equip: ['kettlebell'], muscles: ['front delts','side delts'], secondary: ['triceps','abs'], kind: 'compound', reps: [6, 10], bw: false },
  { id: 'band_overhead_press', name: 'Banded Overhead Press', slot: 'v_push', priority: 7, equip: ['bands'], muscles: ['front delts','side delts'], secondary: ['triceps'], kind: 'compound', reps: [10, 20], bw: false },
  { id: 'pike_push_up', name: 'Pike Push-Up', slot: 'v_push', priority: 8, equip: [], muscles: ['front delts','side delts'], secondary: ['triceps','chest'], kind: 'compound', reps: [6, 15], bw: true },

  // --- chest_fly ---
  { id: 'cable_fly', name: 'Cable Fly', slot: 'chest_fly', priority: 1, equip: ['cable'], muscles: ['chest'], secondary: ['front delts'], kind: 'isolation', reps: [10, 15], bw: false },
  { id: 'pec_deck', name: 'Pec Deck Fly', slot: 'chest_fly', priority: 2, equip: ['machines'], muscles: ['chest'], secondary: ['front delts'], kind: 'isolation', reps: [10, 15], bw: false },
  { id: 'db_fly', name: 'Dumbbell Fly', slot: 'chest_fly', priority: 3, equip: ['dumbbells','bench'], muscles: ['chest'], secondary: ['front delts'], kind: 'isolation', reps: [10, 15], bw: false },
  { id: 'incline_db_fly', name: 'Incline Dumbbell Fly', slot: 'chest_fly', priority: 4, equip: ['dumbbells','adj_bench'], muscles: ['chest','front delts'], secondary: [], kind: 'isolation', reps: [10, 15], bw: false },
  { id: 'low_to_high_cable_fly', name: 'Low-to-High Cable Fly', slot: 'chest_fly', priority: 5, equip: ['cable'], muscles: ['chest','front delts'], secondary: [], kind: 'isolation', reps: [10, 15], bw: false },
  { id: 'band_fly', name: 'Banded Chest Fly', slot: 'chest_fly', priority: 6, equip: ['bands'], muscles: ['chest'], secondary: ['front delts'], kind: 'isolation', reps: [12, 20], bw: false },
  { id: 'push_up_plus', name: 'Push-Up Plus', slot: 'chest_fly', priority: 7, equip: [], muscles: ['chest'], secondary: ['front delts','triceps'], kind: 'isolation', reps: [10, 20], bw: true },

  // --- h_pull ---
  { id: 'bb_bent_over_row', name: 'Barbell Bent-Over Row', slot: 'h_pull', priority: 1, equip: ['barbell'], muscles: ['lats','upper back'], secondary: ['biceps','rear delts','lower back'], kind: 'compound', reps: [6, 10], bw: false },
  { id: 'pendlay_row', name: 'Pendlay Row', slot: 'h_pull', priority: 2, equip: ['barbell'], muscles: ['upper back','lats'], secondary: ['biceps','rear delts','lower back'], kind: 'compound', reps: [5, 8], bw: false },
  { id: 't_bar_row', name: 'T-Bar Row (Landmine)', slot: 'h_pull', priority: 3, equip: ['barbell'], muscles: ['upper back','lats'], secondary: ['biceps','rear delts'], kind: 'compound', reps: [6, 12], bw: false },
  { id: 'chest_supported_db_row', name: 'Chest-Supported Dumbbell Row', slot: 'h_pull', priority: 4, equip: ['dumbbells','adj_bench'], muscles: ['upper back','lats'], secondary: ['biceps','rear delts'], kind: 'compound', reps: [8, 12], bw: false },
  { id: 'seated_cable_row', name: 'Seated Cable Row', slot: 'h_pull', priority: 5, equip: ['cable'], muscles: ['lats','upper back'], secondary: ['biceps','rear delts'], kind: 'compound', reps: [8, 12], bw: false },
  { id: 'machine_row', name: 'Machine Row', slot: 'h_pull', priority: 6, equip: ['machines'], muscles: ['upper back','lats'], secondary: ['biceps','rear delts'], kind: 'compound', reps: [8, 12], bw: false },
  { id: 'one_arm_db_row', name: 'One-Arm Dumbbell Row', slot: 'h_pull', priority: 7, equip: ['dumbbells'], muscles: ['lats','upper back'], secondary: ['biceps','rear delts'], kind: 'compound', reps: [8, 12], bw: false },
  { id: 'seal_row', name: 'Seal Row', slot: 'h_pull', priority: 8, equip: ['barbell','bench'], muscles: ['upper back','lats'], secondary: ['biceps','rear delts'], kind: 'compound', reps: [8, 12], bw: false },
  { id: 'inverted_row', name: 'Inverted Row', slot: 'h_pull', priority: 9, equip: ['pullup_bar'], muscles: ['upper back','lats'], secondary: ['biceps','rear delts','abs'], kind: 'compound', reps: [8, 15], bw: true },
  { id: 'band_row', name: 'Banded Row', slot: 'h_pull', priority: 10, equip: ['bands'], muscles: ['upper back','lats'], secondary: ['biceps','rear delts'], kind: 'compound', reps: [12, 20], bw: false },

  // --- v_pull ---
  { id: 'pull_up', name: 'Pull-Up', slot: 'v_pull', priority: 1, equip: ['pullup_bar'], muscles: ['lats'], secondary: ['biceps','upper back','forearms'], kind: 'compound', reps: [5, 10], bw: true },
  { id: 'lat_pulldown', name: 'Lat Pulldown', slot: 'v_pull', priority: 2, equip: ['cable'], muscles: ['lats'], secondary: ['biceps','upper back'], kind: 'compound', reps: [8, 12], bw: false },
  { id: 'chin_up', name: 'Chin-Up', slot: 'v_pull', priority: 3, equip: ['pullup_bar'], muscles: ['lats','biceps'], secondary: ['upper back','forearms'], kind: 'compound', reps: [5, 10], bw: true },
  { id: 'close_grip_pulldown', name: 'Close-Grip Lat Pulldown', slot: 'v_pull', priority: 4, equip: ['cable'], muscles: ['lats'], secondary: ['biceps','upper back'], kind: 'compound', reps: [8, 12], bw: false },
  { id: 'straight_arm_pulldown', name: 'Straight-Arm Pulldown', slot: 'v_pull', priority: 5, equip: ['cable'], muscles: ['lats'], secondary: ['triceps'], kind: 'isolation', reps: [10, 15], bw: false },
  { id: 'db_pullover', name: 'Dumbbell Pullover', slot: 'v_pull', priority: 6, equip: ['dumbbells','bench'], muscles: ['lats'], secondary: ['chest','triceps'], kind: 'isolation', reps: [10, 15], bw: false },
  { id: 'band_pulldown', name: 'Banded Lat Pulldown', slot: 'v_pull', priority: 7, equip: ['bands'], muscles: ['lats'], secondary: ['biceps','upper back'], kind: 'compound', reps: [10, 20], bw: false },

  // --- rear_delt ---
  { id: 'reverse_pec_deck', name: 'Reverse Pec Deck', slot: 'rear_delt', priority: 1, equip: ['machines'], muscles: ['rear delts'], secondary: ['upper back'], kind: 'isolation', reps: [12, 20], bw: false },
  { id: 'face_pull', name: 'Cable Face Pull', slot: 'rear_delt', priority: 2, equip: ['cable'], muscles: ['rear delts','upper back'], secondary: ['traps'], kind: 'isolation', reps: [12, 20], bw: false },
  { id: 'cable_rear_delt_fly', name: 'Cable Rear Delt Fly', slot: 'rear_delt', priority: 3, equip: ['cable'], muscles: ['rear delts'], secondary: ['upper back'], kind: 'isolation', reps: [12, 20], bw: false },
  { id: 'bent_over_rear_raise', name: 'Bent-Over Dumbbell Rear Raise', slot: 'rear_delt', priority: 4, equip: ['dumbbells'], muscles: ['rear delts'], secondary: ['upper back'], kind: 'isolation', reps: [12, 20], bw: false },
  { id: 'chest_supported_rear_raise', name: 'Chest-Supported Rear Delt Raise', slot: 'rear_delt', priority: 5, equip: ['dumbbells','adj_bench'], muscles: ['rear delts'], secondary: ['upper back'], kind: 'isolation', reps: [12, 20], bw: false },
  { id: 'band_pull_apart', name: 'Band Pull-Apart', slot: 'rear_delt', priority: 6, equip: ['bands'], muscles: ['rear delts','upper back'], secondary: [], kind: 'isolation', reps: [15, 25], bw: false },
  { id: 'prone_y_raise', name: 'Prone Y-Raise', slot: 'rear_delt', priority: 7, equip: [], muscles: ['rear delts','traps'], secondary: ['upper back'], kind: 'isolation', reps: [12, 20], bw: true },

  // --- side_delt ---
  { id: 'cable_lateral_raise', name: 'Cable Lateral Raise', slot: 'side_delt', priority: 1, equip: ['cable'], muscles: ['side delts'], secondary: [], kind: 'isolation', reps: [12, 20], bw: false },
  { id: 'db_lateral_raise', name: 'Dumbbell Lateral Raise', slot: 'side_delt', priority: 2, equip: ['dumbbells'], muscles: ['side delts'], secondary: ['traps'], kind: 'isolation', reps: [12, 20], bw: false },
  { id: 'machine_lateral_raise', name: 'Machine Lateral Raise', slot: 'side_delt', priority: 3, equip: ['machines'], muscles: ['side delts'], secondary: [], kind: 'isolation', reps: [12, 20], bw: false },
  { id: 'band_lateral_raise', name: 'Banded Lateral Raise', slot: 'side_delt', priority: 4, equip: ['bands'], muscles: ['side delts'], secondary: ['traps'], kind: 'isolation', reps: [15, 25], bw: false },
  { id: 'ez_upright_row', name: 'EZ-Bar Upright Row', slot: 'side_delt', priority: 5, equip: ['ez_bar'], muscles: ['side delts','traps'], secondary: ['biceps','front delts'], kind: 'compound', reps: [8, 12], bw: false },

  // --- biceps ---
  { id: 'bb_curl', name: 'Barbell Curl', slot: 'biceps', priority: 1, equip: ['barbell'], muscles: ['biceps'], secondary: ['forearms'], kind: 'isolation', reps: [8, 12], bw: false },
  { id: 'ez_curl', name: 'EZ-Bar Curl', slot: 'biceps', priority: 2, equip: ['ez_bar'], muscles: ['biceps'], secondary: ['forearms'], kind: 'isolation', reps: [8, 12], bw: false },
  { id: 'db_curl', name: 'Dumbbell Curl', slot: 'biceps', priority: 3, equip: ['dumbbells'], muscles: ['biceps'], secondary: ['forearms'], kind: 'isolation', reps: [8, 14], bw: false },
  { id: 'incline_db_curl', name: 'Incline Dumbbell Curl', slot: 'biceps', priority: 4, equip: ['dumbbells','adj_bench'], muscles: ['biceps'], secondary: [], kind: 'isolation', reps: [10, 15], bw: false },
  { id: 'hammer_curl', name: 'Hammer Curl', slot: 'biceps', priority: 5, equip: ['dumbbells'], muscles: ['biceps','forearms'], secondary: [], kind: 'isolation', reps: [8, 14], bw: false },
  { id: 'ez_preacher_curl', name: 'EZ-Bar Preacher Curl', slot: 'biceps', priority: 6, equip: ['ez_bar','adj_bench'], muscles: ['biceps'], secondary: [], kind: 'isolation', reps: [8, 12], bw: false },
  { id: 'cable_curl', name: 'Cable Curl', slot: 'biceps', priority: 7, equip: ['cable'], muscles: ['biceps'], secondary: ['forearms'], kind: 'isolation', reps: [10, 15], bw: false },
  { id: 'machine_preacher_curl', name: 'Machine Preacher Curl', slot: 'biceps', priority: 8, equip: ['machines'], muscles: ['biceps'], secondary: [], kind: 'isolation', reps: [10, 15], bw: false },
  { id: 'concentration_curl', name: 'Concentration Curl', slot: 'biceps', priority: 9, equip: ['dumbbells'], muscles: ['biceps'], secondary: [], kind: 'isolation', reps: [10, 15], bw: false },
  { id: 'band_curl', name: 'Banded Curl', slot: 'biceps', priority: 10, equip: ['bands'], muscles: ['biceps'], secondary: ['forearms'], kind: 'isolation', reps: [12, 20], bw: false },
  { id: 'bw_bar_curl', name: 'Bodyweight Biceps Curl (Bar)', slot: 'biceps', priority: 11, equip: ['pullup_bar'], muscles: ['biceps'], secondary: ['forearms','upper back'], kind: 'isolation', reps: [8, 15], bw: true },

  // --- triceps ---
  { id: 'cable_pushdown', name: 'Cable Triceps Pushdown', slot: 'triceps', priority: 1, equip: ['cable'], muscles: ['triceps'], secondary: [], kind: 'isolation', reps: [10, 15], bw: false },
  { id: 'overhead_cable_extension', name: 'Overhead Cable Triceps Extension', slot: 'triceps', priority: 2, equip: ['cable'], muscles: ['triceps'], secondary: [], kind: 'isolation', reps: [10, 15], bw: false },
  { id: 'ez_skullcrusher', name: 'EZ-Bar Skullcrusher', slot: 'triceps', priority: 3, equip: ['ez_bar','bench'], muscles: ['triceps'], secondary: [], kind: 'isolation', reps: [8, 12], bw: false },
  { id: 'close_grip_bench', name: 'Close-Grip Bench Press', slot: 'triceps', priority: 4, equip: ['barbell','bench'], muscles: ['triceps'], secondary: ['chest','front delts'], kind: 'compound', reps: [6, 10], bw: false },
  { id: 'db_overhead_extension', name: 'Dumbbell Overhead Triceps Extension', slot: 'triceps', priority: 5, equip: ['dumbbells'], muscles: ['triceps'], secondary: [], kind: 'isolation', reps: [10, 15], bw: false },
  { id: 'triceps_dip', name: 'Triceps Dip', slot: 'triceps', priority: 6, equip: ['dip_bars'], muscles: ['triceps'], secondary: ['chest','front delts'], kind: 'compound', reps: [6, 12], bw: true },
  { id: 'db_kickback', name: 'Dumbbell Triceps Kickback', slot: 'triceps', priority: 7, equip: ['dumbbells'], muscles: ['triceps'], secondary: [], kind: 'isolation', reps: [12, 20], bw: false },
  { id: 'band_pushdown', name: 'Banded Triceps Pushdown', slot: 'triceps', priority: 8, equip: ['bands'], muscles: ['triceps'], secondary: [], kind: 'isolation', reps: [12, 20], bw: false },
  { id: 'diamond_push_up', name: 'Diamond Push-Up', slot: 'triceps', priority: 9, equip: [], muscles: ['triceps'], secondary: ['chest','front delts'], kind: 'compound', reps: [8, 20], bw: true },
  { id: 'bench_dip', name: 'Bench Dip', slot: 'triceps', priority: 10, equip: [], muscles: ['triceps'], secondary: ['chest','front delts'], kind: 'compound', reps: [10, 20], bw: true },

  // --- abs ---
  { id: 'hanging_leg_raise', name: 'Hanging Leg Raise', slot: 'abs', priority: 1, equip: ['pullup_bar'], muscles: ['abs'], secondary: ['obliques','forearms'], kind: 'isolation', reps: [8, 15], bw: true },
  { id: 'cable_crunch', name: 'Cable Crunch', slot: 'abs', priority: 2, equip: ['cable'], muscles: ['abs'], secondary: ['obliques'], kind: 'isolation', reps: [10, 15], bw: false },
  { id: 'ab_wheel', name: 'Ab Wheel Rollout', slot: 'abs', priority: 3, equip: [], muscles: ['abs'], secondary: ['lats','obliques'], kind: 'isolation', reps: [8, 15], bw: true },
  { id: 'machine_crunch', name: 'Machine Crunch', slot: 'abs', priority: 4, equip: ['machines'], muscles: ['abs'], secondary: ['obliques'], kind: 'isolation', reps: [10, 15], bw: false },
  { id: 'db_weighted_crunch', name: 'Dumbbell Weighted Crunch', slot: 'abs', priority: 5, equip: ['dumbbells'], muscles: ['abs'], secondary: ['obliques'], kind: 'isolation', reps: [10, 15], bw: false },
  { id: 'pallof_press', name: 'Pallof Press', slot: 'abs', priority: 6, equip: ['cable'], muscles: ['obliques','abs'], secondary: [], kind: 'isolation', reps: [10, 15], bw: false },
  { id: 'reverse_crunch', name: 'Reverse Crunch', slot: 'abs', priority: 7, equip: [], muscles: ['abs'], secondary: ['obliques'], kind: 'isolation', reps: [12, 20], bw: true },
  { id: 'crunch', name: 'Crunch', slot: 'abs', priority: 8, equip: [], muscles: ['abs'], secondary: ['obliques'], kind: 'isolation', reps: [15, 25], bw: true },
  { id: 'dead_bug', name: 'Dead Bug', slot: 'abs', priority: 9, equip: [], muscles: ['abs'], secondary: ['obliques'], kind: 'isolation', reps: [10, 20], bw: true },
  { id: 'plank', name: 'Plank (seconds)', slot: 'abs', priority: 10, equip: [], muscles: ['abs'], secondary: ['obliques','front delts'], kind: 'isolation', reps: [30, 60], bw: true },
];

export function exerciseById(id) { return EXERCISES.find(e => e.id === id); }
