/** Detected ecosystem type */
export type Ecosystem = 'javascript' | 'python' | 'rust';

/** Badge group for ordering */
export type BadgeGroup = 'distribution' | 'runtime' | 'build' | 'quality' | 'metadata' | 'social';


/** Repository metadata collected by detector */
export interface RepositoryMetadata {
  ecosystem: Ecosystem[];
  packageName: string | null;
  /** Per-ecosystem package names for multi-ecosystem projects */
  packageNames: Partial<Record<Ecosystem, string>>;
  /** Whether this project is a monorepo */
  isMonorepo: boolean;
  /** Detected monorepo packages with their paths */
  packages: MonorepoPackage[];
  /** Detected coverage service (codecov, coveralls, or null for generic) */
  coverageService: string | null;
  /** Whether coverage tooling was detected in the project */
  hasCoverage: boolean;
  repositoryUrl: string | null;
  owner: string | null;
  repo: string | null;
  license: string | null;
  workflows: string[];
  nodeVersion: string | null;
  pythonVersion: string | null;
}

/** A package within a monorepo */
export interface MonorepoPackage {
  /** Package name */
  name: string;
  /** Relative path from root */
  path: string;
  /** Detected ecosystem */
  ecosystem: Ecosystem;
}

/** Single badge definition */
export interface Badge {
  type: string;
  group: BadgeGroup;
  label: string;
  imageUrl: string;
  linkUrl: string;
}

/** Result from validator */
export interface ValidationResult {
  badge: Badge;
  issue: 'broken-image' | 'broken-link' | 'missing-workflow' | 'duplicate' | 'mismatched-repo';
  severity: 'error' | 'warning';
  message: string;
  fixable: boolean;
}

/** User configuration (validated by zod) */
export interface Config {
  readme: string;
  badges: {
    order: BadgeGroup[];
    exclude: string[];
    include: string[];
  };
}

