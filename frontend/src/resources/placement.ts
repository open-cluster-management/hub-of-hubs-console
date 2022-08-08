/* Copyright Contributors to the Open Cluster Management project */
import { V1ObjectMeta } from '@kubernetes/client-node/dist/gen/model/v1ObjectMeta'
import { IResource, IResourceDefinition } from './resource'

export const PlacementApiVersion = 'cluster.open-cluster-management.io/v1beta1'
export type PlacementApiVersionType = 'cluster.open-cluster-management.io/v1beta1'

export const PlacementKind = 'Placement'
export type PlacementKindType = 'Placement'

export const PlacementDefinition: IResourceDefinition = {
    apiVersion: PlacementApiVersion,
    kind: PlacementKind,
}

export interface Placement extends IResource {
    apiVersion: PlacementApiVersionType
    kind: PlacementKindType
    metadata: V1ObjectMeta
}
