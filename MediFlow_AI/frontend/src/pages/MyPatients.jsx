import React from 'react';
import Patients from './Patients';

// Doctors get the same list UI; the backend already scopes /patients to their
// own patients via scope_patients, so no extra client filtering is needed.
export default function MyPatients() {
  return <Patients scoped title="My Patients" />;
}
