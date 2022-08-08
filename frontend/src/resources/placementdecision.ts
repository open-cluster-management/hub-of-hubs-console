/* Copyright Contributors to the Open Cluster Management project */
import { V1ObjectMeta } from '@kubernetes/client-node/dist/gen/model/v1ObjectMeta'
import { IResource, IResourceDefinition } from './resource'
import { listResources } from './utils/resource-request'

export const PlacementDecisionApiVersion = 'cluster.open-cluster-management.io/v1beta1'
export type PlacementDecisionApiVersionType = 'cluster.open-cluster-management.io/v1beta1'

export const PlacementDecisionKind = 'PlacementDecision'
export type PlacementDecisionKindType = 'PlacementDecision'

export const PlacementDecisionDefinition: IResourceDefinition = {
    apiVersion: PlacementDecisionApiVersion,
    kind: PlacementDecisionKind,
}

export interface PlacementDecision extends IResource {
    apiVersion: PlacementDecisionApiVersionType
    kind: PlacementDecisionKindType
    metadata: V1ObjectMeta
    status?: {
        decisions?: {
            clusterName: string
        }[]
    }
}

export function listPlacementDecisions(labels?: string[]) {
    return listResources<PlacementDecision>({
        apiVersion: PlacementDecisionApiVersion,
        kind: PlacementDecisionKind,
    }, labels)
}
