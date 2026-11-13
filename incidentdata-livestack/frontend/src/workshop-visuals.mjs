export const WORKSHOP_VISUALS = {
  "incidentdata-overview": {
    "file": "incidentdata-overview.png",
    "caption": "Fictional analysts explore incidents through reports, maps and relationships.",
    "kind": "illustration",
    "width": 1672,
    "height": 941
  },
  "incident-journey": {
    "file": "incident-journey.png",
    "caption": "The learner journey connects an activity overview to source review.",
    "kind": "diagram",
    "width": 1920,
    "height": 1080
  },
  "source-review": {
    "file": "source-review.png",
    "caption": "Original material, authored context and AI drafts remain distinguishable.",
    "kind": "illustration",
    "width": 1672,
    "height": 941
  },
  "data-room-pipeline": {
    "file": "data-room-pipeline.png",
    "caption": "The Data Room workflow records seven stages for a training batch.",
    "kind": "diagram",
    "width": 1920,
    "height": 1080
  },
  "shared-platform": {
    "file": "shared-platform.png",
    "caption": "Conceptual shared platform: React and APEX use the shared IncidentData environment.",
    "kind": "diagram",
    "width": 1920,
    "height": 1080
  },
  "dds-lab": {
    "file": "dds-lab.png",
    "caption": "The dedicated DDS lab examines identities, approved products and grants.",
    "kind": "diagram",
    "width": 1920,
    "height": 1080
  },
  "technology-overview": {
    "file": "technology-overview.png",
    "caption": "Complementary technologies support different ways to explore the incident context.",
    "kind": "illustration",
    "width": 1672,
    "height": 941
  },
  "vector-search-flow": {
    "file": "vector-search-flow.png",
    "caption": "Prepared embeddings and authorised ranking support semantic retrieval.",
    "kind": "diagram",
    "width": 1920,
    "height": 1080
  },
  "spatial-context": {
    "file": "spatial-context.png",
    "caption": "Geographic context links authorised records to a map and report details.",
    "kind": "diagram",
    "width": 1920,
    "height": 1080
  },
  "relationship-graph": {
    "file": "relationship-graph.png",
    "caption": "A conceptual case network makes recorded links inspectable.",
    "kind": "diagram",
    "width": 1920,
    "height": 1080
  },
  "json-duality": {
    "file": "json-duality.png",
    "caption": "A true duality view maps relational data into a JSON document representation.",
    "kind": "diagram",
    "width": 1920,
    "height": 1080
  },
  "select-ai-paths": {
    "file": "select-ai-paths.png",
    "caption": "Reviewed SQL templates and configured Select AI use distinct execution paths.",
    "kind": "diagram",
    "width": 1920,
    "height": 1080
  },
  "agent-framework": {
    "file": "agent-framework.png",
    "caption": "Agent teams use permitted tools to produce outcomes for review.",
    "kind": "diagram",
    "width": 1920,
    "height": 1080
  }
};
export const PAGE_GUIDES = {
  welcome: ['incidentdata-overview', 'index', 'Workshop introduction'],
  workshop: ['technology-overview', 'index', 'Workshop introduction'],
  foundation: ['shared-platform', 'part-1-react', 'Part 1 learner guide'],
  dashboard: ['incident-journey', 'part-1-react', 'Part 1 learner guide'],
  incidents: ['source-review', 'part-1-react', 'Part 1 learner guide'],
  signals: ['vector-search-flow', 'part-1-react', 'Narrative search exercise'],
  persons: ['vector-search-flow', 'capability-map', 'Vector capability guide'],
  evidence: ['source-review', 'part-1-react', 'Source review exercise'],
  graph: ['relationship-graph', 'capability-map', 'Graph capability guide'],
  geography: ['spatial-context', 'part-1-react', 'Spatial context exercise'],
  analytics: ['incident-journey', 'capability-map', 'Technology and capability map'],
  ask: ['select-ai-paths', 'part-1-react', 'Guided question exercise'],
  agents: ['agent-framework', 'capability-map', 'Agent Framework guide'],
  'data-room': ['data-room-pipeline', 'part-2-data-room', 'Data Room learner guide'],
  'ai-ops': ['source-review', 'capability-map', 'Usage and execution distinctions'],
};
export const WORKSHOP_CHAPTERS = [
  {file:'index',title:'Start here',description:'What a LiveStack is, prerequisites and the workshop route.',status:'Workshop introduction',visual:'incidentdata-overview'},
  {file:'part-1-react',title:'Part 1 · React application',description:'Explore activity, reports, location, source links and guided questions.',status:'Learner walkthrough · vector preparation required for extension',visual:'incident-journey'},
  {file:'part-2-data-room',title:'Part 2 · Data Room',description:'Review a supplied training batch and follow the seven-stage pipeline.',status:'Saved-batch route · fixture preparation required',visual:'data-room-pipeline'},
  {file:'part-3-apex',title:'Part 3 · Oracle APEX',description:'Compare an APEX application experience over shared records.',status:'Chapter plan · live validation pending',visual:'shared-platform'},
  {file:'dds-lab',title:'Deep Data Security lab',description:'Understand scripts, execution identities, products and grants.',status:'Script guide · database validation pending',visual:'dds-lab'},
  {file:'capability-map',title:'Technology and capability map',description:'Vector, JSON, Spatial, Graph, Duality, Select AI and agents.',status:'Technical reference',visual:'technology-overview'},
  {file:'presenter-guide',title:'Presenter and preparation guide',description:'Prepare fixtures, choose a reliable route and reset the session.',status:'Instructor reference',visual:'source-review'},
];
