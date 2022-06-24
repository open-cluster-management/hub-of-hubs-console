/* Copyright Contributors to the Open Cluster Management project */

import { get, keyBy } from 'lodash'
import { syncBMAs } from './bare-metal-assets'
import { createManifestWork } from '../resources/manifestwork'
import { NamespaceApiVersion, NamespaceKind } from '../resources/namespace'
import { ManifestWorkApiVersion, ManifestWorkKind } from '../resources/manifestwork'
import { deleteResources } from './delete-resources'

import {
    Cluster,
    IResource,
    ResourceError,
    ResourceErrorCode,
} from '../resources'


export async function createClusterManifestWork(resources: any[]) {
    // if creating a bare metal cluster
    // make sure all the bare metal assets exist

    let errors: any[] = []
    const resourcesMap = keyBy(resources, 'kind')
    const hosts = get(resourcesMap, 'ClusterDeployment.spec.platform.baremetal.hosts')
    if (hosts) {
        ;({ errors } = await syncBMAs(hosts, resources))
        if (errors.length) {
            return {
                status: 'ERROR',
                messages: errors,
            }
        }
    }

    // get namespace and filter out any namespace resource
    // get ClusterDeployment and filter it out to create at the very end
    let namespace = ''
    const clusterResources: any = []
    resources = resources.filter((resource: any) => {
        const { kind, metadata = {}, spec = {} } = resource
        switch (kind) {
            case 'Namespace':
                namespace = metadata.name
                break

            case 'ClusterPool':
                namespace = metadata.namespace
                clusterResources.push(resource)
                ;({ namespace } = metadata)
                break

            case 'ClusterDeployment':
                clusterResources.push(resource)
                ;({ namespace } = metadata)
                break

            case 'ManagedCluster':
                ;({ name: namespace } = metadata)
                // add this annotation to identify the mcl is created from hoh.
                // so we can destroy it from hoh.
                //resource.metadata.annotations['hub-of-hubs.open-cluster-management.io/create-from-hoh'] = 'true'
                break

            default:
                if (spec && spec.clusterNamespace) {
                    namespace = spec.clusterNamespace
                }
                break
        }
        return true
    })

    // create cluster resources
    // errors = []
    // let results = resources.map((resource: any) => createResource(resource))
    // response = await Promise.allSettled(results.map((result: any) => result.promise))
    // response.forEach((result) => {
    //     if (result.status === 'rejected') {
    //         errors.push({ message: result.reason.message })
    //     }
    // })

    // // create cluster resources
    // if (errors.length === 0 && clusterResources.length > 0) {
    //     results = clusterResources.map((resource: any) => createResource(resource))
    //     response = await Promise.allSettled(results.map((result) => result.promise))
    //     response.forEach((result) => {
    //         if (result.status === 'rejected') {
    //             errors.push({ message: result.reason.message })
    //         }
    //     })
    // }
    // create namespace

    resources.push(
        {
            apiVersion: NamespaceApiVersion,
            kind: NamespaceKind,
            metadata: { name: namespace },
        }
    )
    // create clusterrole
    resources.push(
        {
            apiVersion: 'rbac.authorization.k8s.io/v1',
            kind: 'ClusterRole',
            metadata: { name: 'open-cluster-management:hub-of-hubs-managedcluster-creation' },
            rules: [
                {
                    apiGroups: ["cluster.open-cluster-management.io"],
                    resources: ["managedclusters"],
                    verbs: ["create"]
                }
            ]
        }
    )
    // create clusterrolebinding
    resources.push(
        {
            apiVersion: 'rbac.authorization.k8s.io/v1',
            kind: 'ClusterRoleBinding',
            metadata: { name: 'open-cluster-management:hub-of-hubs-managedcluster-creation' },
            roleRef:{
                apiGroup: 'rbac.authorization.k8s.io',
                kind: 'ClusterRole',
                // give the cluster-admin permission temporarily
                // Failed to apply manifest: admission webhook "ocm.validating.webhook.admission.open-cluster-management.io" denied the request: user "system:serviceaccount:open-cluster-management-agent:klusterlet-work-sa" cannot add/remove the resource to/from ManagedClusterSet "default"'
                //name: 'open-cluster-management:hub-of-hubs-managedcluster-creation'
                name: 'cluster-admin'
            },
            subjects: [
                {
                    kind: "ServiceAccount",
                    name: "klusterlet-work-sa",
                    namespace: 'open-cluster-management-agent'
                }
            ]
        }
    )
    let manifests: any[] = []
    resources.filter((resource: any) => {
        manifests.push(
            resource
        )
    })
    const manifestWorkLabels: Record<string, string> = {
    }
    const manifestWorkAnnotations: Record<string, string> = {
    }
    try {
        await createManifestWork({
            manifestWorkName: 'managed-cluster-'+namespace, 
            manifestWorkNamespace: 'hub1',
            manifestWorkLabels,
            manifestWorkAnnotations,
            manifests,
            propagationPolicy: 'SelectivelyOrphan',
            selectivelyOrphans: {
                orphaningRules: [
                    {
                        group: '',
                        resource: 'namespaces',
                        name: namespace,
                    },
                    {
                        group: '',
                        resource: 'secrets',
                        name: namespace + '-aws-creds',
                        namespace: namespace,
                    }
                ]
            }
        }).promise 
    } catch (err) {
        errors.push({ message: err })
    }
      


    // if there were errors, delete any cluster resources
    // if (errors.length > 0) {
    //     const resources: IResource[] = [
    //         {
    //             apiVersion: ManagedClusterApiVersion,
    //             kind: ManagedClusterKind,
    //             metadata: { name: namespace },
    //         },
    //         {
    //             apiVersion: ClusterDeploymentApiVersion,
    //             kind: ClusterDeploymentKind,
    //             metadata: { name: namespace, namespace },
    //         },
    //     ]

    //     await deleteResources(resources).promise
    // }
    // // if this was a bare metal cluster mark the bare metal assets that are used
    // else if (assets) {
    //     const clusterName = get(resourcesMap, 'ClusterDeployment.metadata.name')
    //     await attachBMAs(assets, hosts, clusterName, errors)
    // }

    return {
        status: errors.length > 0 ? 'ERROR' : 'DONE',
        messages: errors.length > 0 ? errors : null,
    }
}


export function deleteClusterManifestWork(cluster: Cluster, ignoreClusterDeploymentNotFound = false) {
    const resources: IResource[] = [
        {
            apiVersion: ManifestWorkApiVersion,
            kind: ManifestWorkKind,
            metadata: { name: 'managed-cluster-'+cluster.name!, namespace: cluster.hubClusterName},
        },
    ]

    const deleteResourcesResult = deleteResources(resources)

    return {
        promise: new Promise((resolve, reject) => {
            deleteResourcesResult.promise.then((promisesSettledResult) => {
                if (promisesSettledResult[0]?.status === 'rejected') {
                    const error = promisesSettledResult[0].reason
                    if (error instanceof ResourceError) {
                        if (ignoreClusterDeploymentNotFound && error.code === ResourceErrorCode.NotFound) {
                            // DO NOTHING
                        } else {
                            reject(promisesSettledResult[0].reason)
                            return
                        }
                    }
                }
                if (promisesSettledResult[1]?.status === 'rejected') {
                    reject(promisesSettledResult[1].reason)
                    return
                }
                resolve(promisesSettledResult)
            })
        }),
        abort: deleteResourcesResult.abort,
    }
}