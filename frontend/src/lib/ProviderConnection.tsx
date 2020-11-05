import { V1ObjectMeta, V1Secret } from '@kubernetes/client-node'
import * as YAML from 'yamljs'
import { ProviderID } from './providers'
import { useQueryWrapper, ResourceList, resourceMethods } from './Resource'

export interface ProviderConnection extends V1Secret {
    apiVersion: 'v1'
    kind: 'Secret'
    metadata?: V1ObjectMeta
    data?: {
        metadata: string
    }
    spec?: {
        awsAccessKeyID?: string
        awsSecretAccessKeyID?: string
        baseDomainResourceGroupName?: string
        clientId?: string
        clientsecret?: string
        subscriptionid?: string
        tenantid?: string
        gcProjectID?: string
        gcServiceAccountKey?: string
        username?: string
        password?: string
        vcenter?: string
        cacertificate?: string
        vmClusterName?: string
        datacenter?: string
        datastore?: string
        libvirtURI?: string
        sshKnownHosts?: string

        // Image Registry Mirror
        // Bootstrap OS Image
        // Cluster OS Image
        // Additional Trust Bundle

        baseDomain: string
        pullSecret: string
        sshPrivatekey: string
        sshPublickey: string
        isOcp?: boolean
    }
}

export const providerConnections = resourceMethods<ProviderConnection>({ path: '/api/v1', plural: 'secrets' })

const originalList = providerConnections.list

providerConnections.list = async (labels?: string[]) => {
    if (!labels) {
        labels = ['cluster.open-cluster-management.io/cloudconnection=']
    } else if (!labels.includes('cluster.open-cluster-management.io/cloudconnection=')) {
        labels.push('cluster.open-cluster-management.io/cloudconnection=')
    }
    const result = await originalList(labels)
    for (const providerConnection of result.data.items) {
        if (providerConnection?.data?.metadata) {
            try {
                const yaml = Buffer.from(providerConnection?.data?.metadata, 'base64').toString('ascii')
                providerConnection.spec = YAML.parse(yaml)
            } catch {}
        }
    }
    return result
}

const originalCreate = providerConnections.create

providerConnections.create = async (providerConnection: ProviderConnection) => {
    const copy = { ...providerConnection }
    delete copy.data
    copy.stringData = { metadata: YAML.stringify(copy.spec) }
    delete copy.spec
    return originalCreate(copy)
}

export function useProviderConnections() {
    return useQueryWrapper<ResourceList<ProviderConnection>>(providerConnections.list)
}

export function getProviderConnectionProviderID(providerConnection: Partial<ProviderConnection>) {
    const label = providerConnection.metadata?.labels?.['cluster.open-cluster-management.io/provider']
    return label as ProviderID
}

export function setProviderConnectionProviderID(
    providerConnection: Partial<ProviderConnection>,
    providerID: ProviderID
) {
    if (!providerConnection.metadata) {
        providerConnection.metadata = {}
    }
    if (!providerConnection.metadata.labels) {
        providerConnection.metadata.labels = {}
    }
    providerConnection.metadata.labels['cluster.open-cluster-management.io/provider'] = providerID
    providerConnection.metadata.labels['cluster.open-cluster-management.io/cloudconnection'] = ''
}
