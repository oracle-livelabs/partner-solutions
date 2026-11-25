// Render current branding while preserving stored telemetry/filter identifiers.
export const displayAppLabel = value => String(value ?? '')
  .replace(/\b(?:Incident\s?Data |Crime\s?Data )?AI Op{1,2}s\b/gi, 'AI Opps')
  .replace(/\b(?:Incident\s?Data(?: Data)?|Crime\s?Data) Room\b/gi, 'Data Room')
  .replace(/\bAdelaide Crime Intelligence\b/gi, 'IncidentData LiveStack')
  .replace(/\bCrime\s?Data(?:[ -]?LiveStack)?\b/gi, match => /livestack/i.test(match) ? 'IncidentData LiveStack' : 'IncidentData')
  .replace(/\bAsk Crime(?: V2)?\b/g, match => match.endsWith('V2') ? 'Ask IncidentData V2' : 'Ask IncidentData');
