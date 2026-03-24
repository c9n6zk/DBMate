CREATE TABLE departments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  floor INT,
  phone VARCHAR(20)
);

CREATE TABLE doctors (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  specialization VARCHAR(100) NOT NULL,
  license_number VARCHAR(50) NOT NULL UNIQUE,
  department_id INT,
  phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);

CREATE TABLE patients (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  date_of_birth DATE NOT NULL,
  gender VARCHAR(10),
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  insurance_number VARCHAR(50),
  blood_type VARCHAR(5),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE appointments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  patient_id INT NOT NULL,
  doctor_id INT NOT NULL,
  appointment_date TIMESTAMP NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 30,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
);

CREATE TABLE diagnoses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  appointment_id INT NOT NULL,
  icd_code VARCHAR(10) NOT NULL,
  description TEXT NOT NULL,
  severity VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
);

CREATE TABLE prescriptions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  diagnosis_id INT NOT NULL,
  medication_name VARCHAR(200) NOT NULL,
  dosage VARCHAR(100) NOT NULL,
  frequency VARCHAR(100) NOT NULL,
  duration_days INT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (diagnosis_id) REFERENCES diagnoses(id) ON DELETE CASCADE
);

CREATE TABLE lab_results (
  id INT PRIMARY KEY AUTO_INCREMENT,
  patient_id INT NOT NULL,
  doctor_id INT NOT NULL,
  test_name VARCHAR(200) NOT NULL,
  result_value VARCHAR(100),
  unit VARCHAR(50),
  reference_range VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  tested_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
);

CREATE TABLE medical_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  patient_id INT NOT NULL,
  doctor_id INT NOT NULL,
  record_type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  attachments TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
);

CREATE TABLE rooms (
  id INT PRIMARY KEY AUTO_INCREMENT,
  room_number VARCHAR(10) NOT NULL UNIQUE,
  department_id INT NOT NULL,
  room_type VARCHAR(50) NOT NULL,
  capacity INT NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'available',
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
);

CREATE TABLE admissions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  patient_id INT NOT NULL,
  room_id INT NOT NULL,
  doctor_id INT NOT NULL,
  admitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  discharged_at TIMESTAMP,
  reason TEXT NOT NULL,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
);

CREATE TABLE billing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  patient_id INT NOT NULL,
  appointment_id INT,
  admission_id INT,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
  due_date DATE,
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
  FOREIGN KEY (admission_id) REFERENCES admissions(id) ON DELETE SET NULL
);
