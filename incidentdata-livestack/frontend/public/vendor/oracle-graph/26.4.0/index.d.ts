/*
 * Copyright (C) 2013, 2026, Oracle and/or its affiliates.
 * ORACLE PROPRIETARY/CONFIDENTIAL. Use is subject to license terms.
 */
import type { Map, SourceSpecification } from 'maplibre-gl';

type Optional<T> = T | undefined;

type Nullable<T> = T | null;

type TypedMap<T> = Record<string, T>;

type NestedPartial<T> = {
  [P in keyof T]?: NestedPartial<T[P]>;
};

type NestedFlags<T> = {
  [P in keyof T]?: T[P] extends object ? false | NestedFlags<T[P]> : T[P];
};

type NestedExpressions<T> = {
  [P in keyof T]: T[P] extends Nullable<Optional<object>> ? NestedExpressions<T[P]> : T[P] | string;
};

type Shortcuts<T> = {
  [P in keyof T]: T[P] extends Nullable<Optional<object>> ? string | T[P] : T[P];
};

type PartialStyle<T> = Shortcuts<NestedExpressions<NestedPartial<T>>>;

type NestedPartialStyle<T> = Omit<PartialStyle<T>, 'children'> & {
  children?: Nullable<TypedMap<PartialStyle<_VertexStyle> & Classable>>;
};

type NonEmptyArray<T> = [T, ...T[]];

type AtLeastOneRequired<T, U = { [K in keyof T]: Pick<T, K> }> = Partial<T> & U[keyof U];

type Id = string | number;

type LegendType = 'vertex' | 'edge';

export type InterpolationType = 'sizes' | 'colors' | 'opacity';

export type TriangleDirection = 'up' | 'down' | 'left' | 'right';

export interface CircleVertexShape {
  type: 'circle';
}

export interface EllipseVertexShape {
  type: 'ellipse';
  widthHeightRatio?: number;
}

export interface SquareVertexShape {
  type: 'square';
}

export interface RectangleVertexShape {
  type: 'rectangle';
  widthHeightRatio?: number;
}

export interface RoundedRectangleVertexShape {
  type: 'roundedRectangle';
  widthHeightRatio?: number;
  cornerRadiusRatio?: number;
}

export interface TriangleVertexShape {
  type: 'triangle';
  direction?: TriangleDirection;
}

export interface DiamondVertexShape {
  type: 'diamond';
}

export interface PentagonVertexShape {
  type: 'pentagon';
}

export interface HexagonVertexShape {
  type: 'hexagon';
}

export interface OctagonVertexShape {
  type: 'octagon';
}

export type VertexShape =
  | CircleVertexShape
  | EllipseVertexShape
  | SquareVertexShape
  | RectangleVertexShape
  | RoundedRectangleVertexShape
  | TriangleVertexShape
  | DiamondVertexShape
  | PentagonVertexShape
  | HexagonVertexShape
  | OctagonVertexShape;

export type ShapeType = VertexShape['type'];

export interface TypedArrayMap<TValue = any> {
  [key: string]: TValue;
}

interface Classable {
  classes?: string[];
}

interface Entity extends Classable {
  id: Id;
  original_id?: ElementId;
  properties?: EntityProperties;
  style?: VertexStyle | EdgeStyle;
  defaultColor?: string;
  labels?: string[];
}

export interface Vertex extends Entity {
  /** Optional viewport-relative position restored for a manually pinned vertex. */
  normalizedPosition?: NormalizedPosition;
}

export interface Edge extends Entity {
  source: Id;
  target: Id;
  /** Indicates an artificial edge that represents an indirect path between visible vertices. */
  isReachab?: boolean;
  /** Lists hidden vertex ids that lie on the underlying indirect path. */
  via?: Id[];
  /** Id of the original edge that supplied the base styling for this indirect edge. */
  seedEdgeId?: Id;
}

interface Fetchable {
  numResults?: number;
  isLastResultSet?: boolean;
}

export interface Graph extends Fetchable {
  vertices: Vertex[];
  edges: Edge[];
  vertexIdColumnNames?: string[];
  edgeIdColumnNames?: string[];
}

/** A backend-specific descriptive element identifier. */
export type ElementId = Record<string, unknown>;

export type RelationshipType = 'descendant' | 'ancestor' | 'sibling';
export type VertexSearchResult = Record<Id, Vertex>;
export type EdgesSearchResult = Record<Id, Edge>;
export type DefaultProps = Record<Id, string | number>;

export type GetActiveElementParams = {
  activeElementIndex: number;
  vertices: Vertex[];
  edges: Edge[];
  elementMode: TraverseMode;
  selection: Entity[];
  searchKeyword: string | undefined;
};

export interface SearchResult {
  vertices?: VertexSearchResult;
  edges?: EdgesSearchResult;
  defaultProps?: DefaultProps;
}

export type FeatureFlags =
  | false
  | NestedFlags<{
      exploration: {
        expand: boolean;
        focus: boolean;
        group: boolean;
        ungroup: boolean;
        drop: boolean;
        undo: boolean;
        redo: boolean;
        reset: boolean;
      };
      modes: {
        interaction: boolean;
        fitToScreen: boolean;
        sticky: boolean;
        evolution: boolean;
        reachabilityPaths: boolean;
      };
      displaySizeControl: boolean;
    }>;

type LayoutType =
  | 'circle'
  | 'concentric'
  | 'force'
  | 'grid'
  | 'hierarchical'
  | 'preset'
  | 'radial'
  | 'random'
  | 'geographical';

interface BaseLayoutSettings {
  type: LayoutType;
}

interface SpacingLayoutSettings {
  spacing: number;
}

interface CircleLayoutSettings extends BaseLayoutSettings, SpacingLayoutSettings {
  type: 'circle';
}

interface ClusterOptions {
  clusterBy?: string;
  hideUnclusteredVertices?: boolean;
}

interface ConcentricLayoutSettings extends BaseLayoutSettings, SpacingLayoutSettings {
  type: 'concentric';
}

interface ForceLayoutSettings extends BaseLayoutSettings, SpacingLayoutSettings {
  type: 'force';
  alphaDecay: number;
  velocityDecay: number;
  edgeDistance: number;
  vertexCharge: number;
  clusterEnabled: boolean;
  clusterOptions?: ClusterOptions;
}

interface GridLayoutSettings extends BaseLayoutSettings, SpacingLayoutSettings {
  type: 'grid';
  rows?: number;
  columns?: number;
}

type HierarchicalRankDirection = 'UL' | 'UR' | 'DL' | 'DR' | 'TB' | 'BT' | 'LR' | 'RL';

type HierarchicalRanker = 'network-simplex' | 'tight-tree' | 'longest-path';

interface HierarchicalLayoutSettings extends BaseLayoutSettings {
  type: 'hierarchical';
  rankDirection: HierarchicalRankDirection;
  ranker: HierarchicalRanker;
  vertexSeparation?: number;
  edgeSeparation?: number;
  rankSeparation?: number;
}

interface PresetLayoutSettings extends BaseLayoutSettings {
  type: 'preset';
  x: string;
  y: string;
}

interface RadialLayoutSettings extends BaseLayoutSettings, SpacingLayoutSettings {
  type: 'radial';
}

interface RandomLayoutSettings extends BaseLayoutSettings {
  type: 'random';
}

interface GeographicalLayoutSettings extends BaseLayoutSettings {
  type: 'geographical';
  longitude: string;
  latitude: string;
  appId?: string;
  mapType?: MapType;
  showInfo?: boolean;
  showNavigation?: boolean;
  layers?: string;
  sources?: string;
  markers?: MapMarker[];
}

export type Sources = Record<string, SourceSpecification>;

export type MapType = 'osm_positron' | 'osm_bright' | 'osm_darkmatter' | 'world_map_mb' | 'custom_type';

interface MapMarker {
  longitude: number;
  latitude: number;
  content?: string;
}

export type SliderValues = {
  min: number;
  max: number;
  step: number;
  scale: number;
};

export type SliderSettings = { [key in FilterComponent]: SliderValues };

export type HighlightTargets = {
  [key in FilterComponent]: {
    id: ApplyTarget;
    type: FilterComponent;
  }[];
};

export type HighlightType = 'styling' | 'visibility' | 'aggregation';

export type HighlightStylingType =
  | 'size'
  | 'color'
  | 'caption'
  | 'icon'
  | 'image'
  | 'edgeStyle'
  | 'animationsVertex'
  | 'animationsEdge';

export type FilterOperator = '<' | '<=' | '>' | '>=' | '=' | '!=' | '~' | 'CONTAINS' | 'CONTAINS_REGEX';

export type HighlightAttributesType = {
  type: HighlightStylingType;
};

export type HighlightAttributes = {
  [key in ApplyTarget]: HighlightAttributesType[];
};

export type FilterTarget = {
  id: FilterComponent;
};

export type ApplyTarget = 'vertex' | 'source' | 'target' | 'edge' | 'ingoing' | 'outgoing';

export type FilterComponent = 'vertex' | 'edge';

export type ElementPropertyValue =
  | string
  | number
  | boolean
  | string[]
  | { [key: string]: ElementPropertyValue }
  | ElementPropertyValue[];

export interface ElementProperty<T> {
  property: string;
  value: T;
}

export interface BasicCondition extends ElementProperty<string | string[]> {
  operator: FilterOperator;
}

export interface RuleCondition {
  rule: string;
}

export type ConditionsOperator = 'and' | 'or';

export interface Conditions<T extends RuleCondition | BasicCondition> {
  conditions: T[];
  operator?: ConditionsOperator;
}

export type interpolationFunction = (t: number) => string | number;

export interface FilterInterpolation {
  property: string;
  min?: number;
  max?: number;
}

export declare type FilterProperties = {
  colors?: string[];
  classes?: string[];
  sizes?: number[];
  opacity?: number[];
};

export interface FromTemplate {
  _fromTemplate?: boolean;
  _id?: number | string;
}

export interface LegendStyleSetting {
  visibilityEnabled?: boolean;
  stylingEnabled?: boolean;
  style?: Partial<VertexStyle> | Partial<EdgeStyle>;
}

export type AggregationType = 'average' | 'min' | 'max' | 'sum' | 'count' | 'distinctCount';

export interface PropertyAggregation {
  enabled?: boolean;
  property?: string;
  type: AggregationType;
}

export type StyleAction = 'visibilityToggle' | 'stylingToggle' | 'reorder';

export type OverlayIndicatorIcon = 'pin' | 'bookmark';

export interface RuleBasedStyleSetting extends FromTemplate, LegendStyleSetting {
  originalId?: Id;
  legendDisplayed?: boolean;
  conditions?: Conditions<BasicCondition | RuleCondition>;
  component: FilterComponent;
  target: ApplyTarget;
  properties?: FilterProperties;
  interpolation?: FilterInterpolation;
  filterReferenceIds?: number[];
  legendTitle?: string;
  legendDescription?: string;
  modifierStyles?: TypedMap<VertexStyle | EdgeStyle>;
  animations?: GraphAnimation[][];
  isDefaultRule?: boolean;
  overlayIndicator?: OverlayIndicatorIcon;
}

export interface LegendEntry extends RuleBasedStyleSetting {
  legendTitle?: string[];
  legendEntryVisible: boolean;
  style: Partial<VertexStyle> | Partial<EdgeStyle>;
  filteredNodes: Vertex[] | Edge[];
  toApplyStyle?: Partial<VertexStyle> | Partial<EdgeStyle>;
}

// NOTE: For rule-based group/expand

export interface ExpandCondition extends BasicCondition {
  component: FilterComponent;
}
export type RuleBasedExplorerType = 'expand' | 'group';

export interface RuleBasedExplorer extends FromTemplate {
  readonly type: RuleBasedExplorerType;
  name: string;
}

export interface RuleBasedGroup extends RuleBasedExplorer, LegendStyleSetting {
  readonly type: 'group';
  applyOnLoad: boolean;
  enabled: boolean;
  component: 'vertex' | 'edge';
  groupBy?: string;
  conditions: Conditions<ExpandCondition>;
  aggregations?: PropertyAggregation[];
}

export interface ManualGroupLegendEntry extends LegendStyleSetting {
  type: 'manualGroup';
  component: 'vertex' | 'edge';
  name: 'Manually grouped';
}

export type GroupLegendEntry = RuleBasedGroup | ManualGroupLegendEntry;

export interface RuleBasedExpand extends RuleBasedExplorer {
  readonly type: 'expand';
  numberOfHops: Optional<number>;
  navigation: Conditions<ExpandCondition>;
  destination: Conditions<ExpandCondition>;
}

type LayoutSettings =
  | CircleLayoutSettings
  | ConcentricLayoutSettings
  | ForceLayoutSettings
  | GridLayoutSettings
  | HierarchicalLayoutSettings
  | PresetLayoutSettings
  | RadialLayoutSettings
  | RandomLayoutSettings
  | GeographicalLayoutSettings;

interface EvolutionEntity {
  start: string;
  end?: string;
}

export type EvolutionUnit = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';

interface Evolution {
  height: number;
  chart: 'bar' | 'line';
  granularity: number;
  unit?: EvolutionUnit;
  vertex?: EvolutionEntity;
  edge?: EvolutionEntity;
  exclude: {
    values: (string | number)[];
    show: boolean;
  };
  playback: {
    step: number;
    timeout: number;
  };
  preservePositions?: boolean;
  axis?: 'vertices' | 'edges' | 'both';
  labelFormat?: string;
}

interface GraphAnimation {
  id?: string;
  duration: number;
  timingFunction: string;
  direction?: string;
  keyFrames: KeyFrame[];
  iterationCount?: number;
}

interface CustomTheme {
  backgroundColor?: string;
  textColor?: string;
}

export type Theme = 'light' | 'dark';

export interface PropertyFormat {
  type?: 'number' | 'date';
  locale?: string;
  style?: 'decimal' | 'currency' | 'percent';
  currency?: string;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  dateFormat?: string;
}

export interface ScopedPropertyFormat extends PropertyFormat {
  elementType: 'vertex' | 'edge';
  labels: string[];
  property: string;
}

export type PropertyFormats = ScopedPropertyFormat[];

export type EdgeMarker = 'arrow' | 'none';

export type ExpandedState = 'expanded' | 'collapsed';

type DefaultSettings = {
  interactionActive: Optional<Boolean>;
  fitToScreenActive: Optional<Boolean>;
  stickyActive: Optional<Boolean>;
  evolutionActive: Optional<Boolean>;
  reachabilityPathsActive: Optional<Boolean>;
  explorationModeActive: Optional<Boolean>;
};

interface _Settings {
  // @Deprecated since version 25.3, use displaySizeOnLoad instead
  pageSize?: number;
  formatNumbers: boolean;
  propertyFormats?: PropertyFormats;
  searchEnabled: boolean;
  groupEdges: boolean;
  escapeHtml: boolean;
  layout: LayoutType | Partial<LayoutSettings>;
  evolution: NestedPartial<Shortcuts<Evolution>>;
  legendWidth: number;
  numberOfHops: number;
  maxNumberOfHops: number;
  ruleBasedExpands: RuleBasedExpand[];
  ruleBasedGroups: RuleBasedGroup[];
  selectedRuleBasedExpand: Nullable<number>;
  selectedRuleBasedGroup: Nullable<number>;
  selectedExplorationSave?: Nullable<string>;
  sizeMode: SizeMode;
  searchValue: string | undefined;
  theme: Theme;
  edgeMarker: EdgeMarker;
  charLimit: number;
  showTitle: boolean;
  vertexLabelProperty: Nullable<string>;
  edgeLabelProperty: Nullable<string>;
  customTheme: CustomTheme;
  tooltipCharLimit: Nullable<number>;
  ruleBasedStyles: RuleBasedStyleSetting[];
  baseStyles: Styles;
  viewMode?: ExpandedState;
  viewLabel?: string;
  legendState?: ExpandedState;
  accessibilityEnabled?: Boolean;
  visibilityToggleMode?: VisibilityToggleMode;
  defaults: Partial<DefaultSettings>;
  displaySizeOnLoad?: number;
  defaultLegendEnabled?: boolean;
}
export type VisibilityToggleMode = 'hideWhenAnyUnchecked' | 'hideWhenAllUnchecked';
export type SizeMode = 'compact' | 'normal';
export type ControlSizeMode = SizeMode | 'large';

interface ElementPosition {
  angle?: Nullable<number>;
  position: number;
  d: number;
}

interface FontStyle {
  size: number;
  family: string;
  style: string;
  weight: string;
}

interface LabelStyle extends ElementPosition {
  text: string;
  color?: string;
  maxLength: number;
  font: FontStyle;
  disableBackdrop: boolean;
  resizeParent: boolean;
}

interface Style extends ElementPosition {
  color: string | string[];
  opacity: number;
  filter: string;
  caption?: Nullable<LabelStyle>;
  children: Nullable<TypedMap<_VertexStyle & Classable>>;
  legend: Nullable<this & { text: string }>;
}

interface ImageStyle {
  url: string;
  scale: number;
}

interface BorderStyle {
  width: number;
  color: string;
}

interface IconStyle {
  class: string;
  color: string;
}

interface _VertexStyle extends Style {
  size: number;
  image: Nullable<ImageStyle>;
  border: Nullable<BorderStyle>;
  icon: Nullable<IconStyle>;
  relationshipCaption?: Nullable<LabelStyle>;
  shape?: Nullable<ShapeType | VertexShape>;
}

interface _EdgeStyle extends Style {
  width: number;
  dasharray?: string;
}

export interface EdgeWithLayout extends Edge {
  _source: Id;
  _target: Id;
}
export interface ReachabilityPathDescriptor {
  source: Id;
  target: Id;
  via: Id[];
  seedEdgeId: Id;
  hiddenVertexCount: number;
  hiddenVertices: Id[];
  hiddenEdgeCount: number;
  hiddenEdges: Id[];
}

export interface QueueEntry {
  seedEdgeId: Id;
  current: Id;
  via: Id[];
  visited: Set<Id>;
  depth: number;
  hiddenPathEdges: Id[];
}

type EntityEventCallback = (event: Event, id: Optional<string>, entity: Entity) => void;

interface _EntityEventHandlers {
  [eventType: string]: EntityEventCallback | _EntityEventHandlers;
  children?: EntityEventHandlers;
}
interface _AllEventHandlers {
  vertex: EntityEventHandlers;
  edge: EntityEventHandlers;
}

export type Settings = Partial<_Settings>;

export type VertexStyle = NestedPartialStyle<_VertexStyle>;

export type EdgeStyle = NestedPartialStyle<_EdgeStyle>;

export type Styles = TypedMap<VertexStyle | EdgeStyle>;

export type EntityEventHandlers = Optional<_EntityEventHandlers>;

export type AllEventHandlers = Partial<_AllEventHandlers>;

export type FetchMore = (start: number, size: number) => Promise<Graph>;

export type OnManyClick = (
  graphQuery: string,
  vertexIdColumnNames: string[],
  edgeIdColumnNames: string[]
) => Promisable<{ vertexCount: number; edgeCount: number }>;

export type Search = (keyword: string, searchGraph?: Optional<_Graph>) => Promise<SearchResult>;

export type Expand = (
  ids: Id[],
  hops: number,
  action: ExpandActionType,
  templateId?: number | null,
  relationshipType?: RelationshipType
) => Promise<Graph>;

/**
 * @deprecated Use the centralized `update` callback for supported persistence
 * operations. This fallback will be removed in GVT-1168.
 */
export type Persist = (action: GraphAction) => Promise<void>;

export type UpdateGeoMap = (mapElement: Map) => Promise<void>;

/**
 * @deprecated Use the centralized `update` callback with
 * `ruleBasedGroup/select` or `ruleBasedExpand/select`. This fallback will be
 * removed in GVT-1168.
 */
export type UpdateSelectedOption = (option: number | null, tag: RuleBasedExplorerType) => Promise<void>;

/**
 * @deprecated Use the centralized `update` callback with `evolution/state`.
 * This fallback will be removed in GVT-1168.
 */
export type UpdateEvolution = (enabled: boolean) => Promise<void>;

/**
 * @deprecated Use the centralized `update` callback with `search/keyword`.
 * This fallback will be removed in GVT-1168.
 */
export type UpdateSearchValue = (value: string) => Promise<void>;

/**
 * @deprecated Use the centralized `update` callback with `graph/data`.
 * This fallback will be removed in GVT-1168.
 */
export type UpdateGraphData = (Vertices: Vertex[], edges: Edge[]) => Promise<void>;

/**
 * @deprecated Use the centralized `update` callback with
 * `ruleBasedStyle/update`. This fallback will be removed in GVT-1168.
 */
export type UpdateRuleBasedStyle = (
  style: RuleBasedStyleSetting | RuleBasedStyleSetting[],
  action?: StyleAction
) => Promise<void>;

/**
 * @deprecated Use the centralized `update` callback with
 * `ruleBasedStyle/editStyle`. This fallback will be removed in GVT-1168.
 */
export type EditRuleBasedStyle = (style: RuleBasedStyleSetting) => Promise<void>;

export interface ExplorationSave {
  id: string;
  name: string;
  actions: GraphAction[];
  currentActionIndex?: number;
  createdAt?: string;
  updatedAt?: string;
}

// Single entry point for host-managed update actions; Existing individual callbacks are being unified into this single entry point.
export type UpdateAction =
  // Graph-level events
  | { type: 'graph/data'; vertices: Vertex[]; edges: Edge[] }
  // Vertex-level persistence
  | { type: 'vertexPosition/upsert'; vertexPositions: NormalizedPosition[] }
  | { type: 'vertexPosition/delete'; vertexIds: Id[] }
  // Rule-based styles, groups and expand events
  | { type: 'ruleBasedStyle/editStyle'; ruleBasedStyle: RuleBasedStyleSetting }
  | {
      type: 'ruleBasedStyle/update';
      action: 'visibilityToggle' | 'stylingToggle';
      ruleBasedStyle: RuleBasedStyleSetting;
    }
  | { type: 'ruleBasedStyle/update'; action: 'reorder'; ruleBasedStyles: RuleBasedStyleSetting[] }
  | { type: 'ruleBasedGroup/editStyle'; ruleBasedGroup: RuleBasedGroup }
  | { type: 'ruleBasedGroup/select'; option: number | null }
  | { type: 'ruleBasedExpand/select'; option: number | null }
  // Exploration save persistence
  | { type: 'exploration/upsert'; explorationSave: ExplorationSave; insertAfterId?: string }
  | { type: 'exploration/delete'; id: string }
  | { type: 'exploration/select'; id: string | null }
  // Saved-search persistence
  | { type: 'savedSearch/upsert'; savedSearch: SavedSearch; insertAfterId?: string }
  | { type: 'savedSearch/delete'; id: string }
  // Lightweight state notifications
  | { type: 'evolution/state'; enabled: boolean }
  | { type: 'search/keyword'; keyword: string };

export type UpdateActionType = UpdateAction['type'];

export type UpdateResult = { success: true } | { success: false; severity: 'warning' | 'error'; message: string };

export type Update = (action: UpdateAction) => Promise<UpdateResult | void> | UpdateResult | void;

export type UpdateSupportedActions = UpdateActionType[];

/**
 * Saved Conditional Search types
 */
export type SavedSearchId = string;

export interface SavedSearch {
  id?: SavedSearchId;
  name: string;
  selectedLabels: string[];
  // Use unknown to avoid a hard dependency on utils.FilterNode from this declaration file
  filterRoot: unknown;
  createdAt?: string;
  updatedAt?: string;
}

// Remove as part of GVT-1168
export interface SavedSearchProvider {
  /** @deprecated Use the centralized update callback with savedSearch/upsert and savedSearch/delete. */
  list?: () => Promise<SavedSearch[]>;
  /** @deprecated Use update({ type: 'savedSearch/upsert', savedSearch }). */
  upsert?: (config: SavedSearch) => Promise<SavedSearch | void> | SavedSearch | void;
  /** @deprecated Use update({ type: 'savedSearch/delete', idOrName }). */
  remove?: (idOrName: string) => Promise<void> | void;
}

/** @deprecated Use UpdateAction instead. Remove as part of GVT-1168*/
export type SavedSearchAction =
  | { type: 'saved_search/save'; config: SavedSearch }
  | { type: 'saved_search/delete'; idOrName: string }
  | { type: 'saved_search/load'; idOrName: string };

/**
 * @deprecated Provide initial exploration actions through `explorationSaves`
 * and select one with `settings.selectedExplorationSave`. This fallback will
 * be removed in GVT-1168.
 */
export type FetchActions = () => Promise<GraphAction[]>;

export type GraphActionType =
  | 'drop'
  | 'expand'
  | 'focus'
  | 'group'
  | 'ungroup'
  | 'vertexPosition'
  | 'groupPosition'
  | 'resetVertexPositions'
  | 'undo'
  | 'redo'
  | 'reset';

export interface NormalizedPosition {
  id: Id;
  xRatio: number;
  yRatio: number;
}

export type GraphStatus = 'loaded' | 'loading' | 'info' | 'none';

export type ExpandActionType = 'expand' | 'focus';

export interface GraphAction {
  type: GraphActionType;
  vertexIds?: NonEmptyArray<Id>;
  edgeIds?: NonEmptyArray<Id>;
  template?: Nullable<number | string>;
  vertexPositions?: NormalizedPosition[];
  groupPositions?: NormalizedPosition[];
}

export type EmptyAction = Pick<GraphAction, 'type'>;

export type VerticesAction = Pick<GraphAction, 'type' | 'vertexIds'>;

export type VerticesOrEdgesAction = AtLeastOneRequired<Pick<GraphAction, 'vertexIds' | 'edgeIds'>> & EmptyAction;

interface IComponentOptions<Props extends Record<string, any> = Record<string, any>> {
  target: Element | ShadowRoot;
  anchor?: Element;
  props?: Props;
  context?: Map<any, any>;
  hydrate?: boolean;
  intro?: boolean;
  $$inline?: boolean;
}

export interface PropertySchema {
  name: string;
  actualDataType?: string;
  dataType: 'string' | 'boolean' | 'number' | 'date' | 'timestamp' | 'object';
  limits?: number[];
  mandatory?: boolean;
}

export interface EntityLabelSchema {
  labels: string[];
  properties: PropertySchema[];
}

export interface VertexLabelSchema extends EntityLabelSchema {}

export interface EdgeLabelSchema extends EntityLabelSchema {
  sourceVertexLabels?: string[];
  targetVertexLabels?: string[];
}

export interface GraphSchema {
  vertices: VertexLabelSchema[];
  edges: EdgeLabelSchema[];
}

export type EntityValidationType = 'vertex' | 'edge' | 'schema vertex' | 'schema edge';

export interface EntityValidationError {
  entityType?: EntityValidationType;
  entityId?: string;
  entityLabel?: string[];
  property?: string;
  actualType?: string;
  expectedType?: string;
  message?: string;
}

export interface StyleValidationError extends EntityValidationError {
  errorType: 'CONDITIONS_MISSING' | 'OPERATION_NOT_SUPPORTED';
  operator?: FilterOperator;
}

/* eslint-disable @typescript-eslint/no-unused-vars */

export interface SvelteComponentTyped<
  Props extends Record<string, any> = any,
  Events extends Record<string, any> = any,
  Slots extends Record<string, any> = any
> {
  $set(props?: Partial<Props>): void;
  $on<K extends Extract<keyof Events, string>>(type: K, callback: (e: Events[K]) => void): () => void;
  $destroy(): void;
  [accessor: string]: any;
}

export declare class SvelteComponentTyped<
  Props extends Record<string, any> = any,
  Events extends Record<string, any> = any,
  Slots extends Record<string, any> = any
> {
  constructor(options: IComponentOptions<Props>);
}

export default class extends SvelteComponentTyped<
  Partial<{
    data: Graph;
    settings: Settings;
    schema: GraphSchema;
    schemaSettings: Settings;
    styles: Styles;
    featureFlags: FeatureFlags;
    fetchMore: Optional<FetchMore>;
    expand: Optional<Expand>;
    eventHandlers: AllEventHandlers;
    // @Deprecated since version 26.2, use conditional search instead
    searchValueChanged: Optional<Search>;
    hover: Entity[];
    /** @deprecated Use `explorationSaves` and `settings.selectedExplorationSave`. */
    fetchActions: Optional<FetchActions>;
    /** @deprecated Use the centralized `update` callback. */
    persist: Optional<Persist>;
    /** @deprecated Use `update` with `ruleBasedStyle/update`. */
    updateRuleBasedStyle: Optional<UpdateRuleBasedStyle>;
    /** @deprecated Use `update` with `ruleBasedGroup/select` or `ruleBasedExpand/select`. */
    updateSelectedOption: Optional<UpdateSelectedOption>;
    /** @deprecated Use `update` with `evolution/state`. */
    updateEvolution: Optional<UpdateEvolution>;
    /** @deprecated Use `update` with `graph/data`. */
    updateGraphData: Optional<UpdateGraphData>;
    /** @deprecated Use `update` with `search/keyword`. */
    updateSearchValue: Optional<UpdateSearchValue>;
    /** @deprecated Use `update` with `ruleBasedStyle/editStyle`. */
    editRuleBasedStyle: Optional<EditRuleBasedStyle>;
    onManyClick: Optional<OnManyClick>;
    savedSearches: SavedSearch[];
    /** @deprecated Use the centralized update callback instead. Remove as part of GVT-1168*/
    savedSearchProvider: SavedSearchProvider;
    update: Optional<Update>;
    updateSupportedActions: UpdateSupportedActions;
    explorationSaves: ExplorationSave[];
  }>
> {}
