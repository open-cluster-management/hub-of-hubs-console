/* Copyright Contributors to the Open Cluster Management project */

import { createManifestWork } from '../resources/manifestwork'
import { ManifestWorkApiVersion, ManifestWorkKind } from '../resources/manifestwork'
import { deleteResources } from './delete-resources'

import {
    Cluster,
    IResource,
    ResourceError,
    ResourceErrorCode,
} from '../resources'

export async function createClusterManifestWork(resource: any) {
    // if creating a bare metal cluster
    // make sure all the bare metal assets exist
    
    let errors: any[] = []
    // if (hubCluster == '') {
    //     errors.push({ message: 'cannot find proper ACM hub cluster to place this managed cluster.' })
    //     return {
    //         status: errors.length > 0 ? 'ERROR' : 'DONE',
    //         messages: errors.length > 0 ? errors : null,
    //     }
    // }
 
    // const resourcesMap = keyBy(resources, 'kind')
    // const hosts = get(resourcesMap, 'ClusterDeployment.spec.platform.baremetal.hosts')
    // if (hosts) {
    //     ;({ errors } = await syncBMAs(hosts, resources))
    //     if (errors.length) {
    //         return {
    //             status: 'ERROR',
    //             messages: errors,
    //         }
    //     }
    // }

    // get namespace and filter out any namespace resource
    // get ClusterDeployment and filter it out to create at the very end
    // let namespace = ''
    // const clusterResources: any = []
    // resources = resources.filter((resource: any) => {
    //     const { kind, metadata = {}, spec = {} } = resource
    //     switch (kind) {
    //         case 'Namespace':
    //             namespace = metadata.name
    //             break

    //         case 'ClusterPool':
    //             namespace = metadata.namespace
    //             clusterResources.push(resource)
    //             ;({ namespace } = metadata)
    //             break

    //         case 'ClusterDeployment':
    //             clusterResources.push(resource)
    //             ;({ namespace } = metadata)
    //             break

    //         case 'ManagedCluster':
    //             ;({ name: namespace } = metadata)
    //             // add this annotation to identify the mcl is created from hoh.
    //             // so we can destroy it from hoh.
    //             //resource.metadata.annotations['hub-of-hubs.open-cluster-management.io/create-from-hoh'] = 'true'
    //             break

    //         default:
    //             if (spec && spec.clusterNamespace) {
    //                 namespace = spec.clusterNamespace
    //             }
    //             break
    //     }
    //     return true
    // })

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

    try {
        await createManifestWork(resource).promise 
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