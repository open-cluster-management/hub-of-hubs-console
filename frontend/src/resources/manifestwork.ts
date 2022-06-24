/* Copyright Contributors to the Open Cluster Management project */

import { V1ObjectMeta } from '@kubernetes/client-node/dist/gen/model/v1ObjectMeta'
import { IResource, IResourceDefinition } from './resource'
import { createResource } from './utils/resource-request'

export const ManifestWorkApiVersion = 'work.open-cluster-management.io/v1'
export type ManifestWorkApiVersionType = 'work.open-cluster-management.io/v1'

export const ManifestWorkKind = 'ManifestWork'
export type ManifestWorkKindType = 'ManifestWork'

export const ManifestWorkDefinition: IResourceDefinition = {
    apiVersion: ManifestWorkApiVersion,
    kind: ManifestWorkKind,
}

export interface ManifestsCondition {
    statusFeedback: StatusFeedback
    resourceMeta: {
        kind: string,
        group: string,
    }
}

export interface StatusFeedback {
    values: {
        fieldValue: { string: string; type: string }
        name: string
    }[]
}

export interface ManifestWork extends IResource {
    apiVersion: ManifestWorkApiVersionType
    kind: ManifestWorkKindType
    metadata: V1ObjectMeta
    spec?: {
        workload?: {
            manifests: any[]
        },
        deleteOption?: {
            propagationPolicy: string, //SelectivelyOrphan
            selectivelyOrphans?: {
                orphaningRules: {
                    resource: string,
                    name: string
                    namespace?: string
                    group?: string
                }[]
            }
        }
    }
    status?: {
        resourceStatus: {
            manifests: ManifestsCondition[] 
        },
    }
}

export const createManifestWork = (data: {
    manifestWorkName: string | undefined
    manifestWorkNamespace: string | undefined
    manifestWorkLabels: Record<string, string>
    manifestWorkAnnotations?: Record<string, string>
    manifests:any[]
    propagationPolicy: string | 'Foreground'
    selectivelyOrphans: any
}) => {
    return createResource<ManifestWork>({
        apiVersion: ManifestWorkApiVersion,
        kind: ManifestWorkKind,
        metadata: {
            name: data.manifestWorkName,
            namespace: data.manifestWorkNamespace,
            labels: data.manifestWorkLabels,
            annotations: data.manifestWorkAnnotations,
        },
        spec: {
            workload: {
                manifests: data.manifests
            },
            deleteOption: {
                propagationPolicy: data.propagationPolicy,
                selectivelyOrphans: data.selectivelyOrphans
            }
        }
    })
}
