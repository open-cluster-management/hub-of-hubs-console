/* Copyright Contributors to the Open Cluster Management project */

import {
    Addon,
    Cluster,
    ClusterCurator,
    ClusterDeployment,
    ClusterStatus,
    getCluster,
    mapAddons,
    ResourceError,
    SecretDefinition,
} from '../../../../../resources'
import {
    AcmActionGroup,
    AcmButton,
    AcmLaunchLink,
    AcmPage,
    AcmPageHeader,
    AcmRoute,
    AcmSecondaryNav,
    AcmSecondaryNavItem,
    Provider,
} from '@open-cluster-management/ui-components'
import { Page } from '@patternfly/react-core'
import { createContext, Fragment, Suspense, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Redirect, Route, RouteComponentProps, Switch, useHistory, useLocation } from 'react-router-dom'
import { useRecoilState, useRecoilValue, waitForAll } from 'recoil'
import { CIM } from 'openshift-assisted-ui-lib'
import {
    hubOfHubsRouteState,
    certificateSigningRequestsState,
    clusterClaimsState,
    clusterCuratorsState,
    clusterDeploymentsState,
    clusterManagementAddonsState,
    managedClusterAddonsState,
    managedClusterInfosState,
    managedClustersState,
    agentClusterInstallsState,
    agentsState,
    infraEnvironmentsState,
    manifestWorksState,
} from '../../../../../atoms'
import { ErrorPage } from '../../../../../components/ErrorPage'
import { usePrevious } from '../../../../../components/usePrevious'
import { canUser } from '../../../../../lib/rbac-util'
import { NavigationPath } from '../../../../../NavigationPath'
import { ClusterActionDropdown } from '../components/ClusterActionDropdown'
import { ClusterDestroy } from '../components/ClusterDestroy'
import { DownloadConfigurationDropdown } from '../components/DownloadConfigurationDropdown'
import { MachinePoolsPageContent } from './ClusterMachinePools/ClusterMachinePools'
import { NodePoolsPageContent } from './ClusterNodes/ClusterNodes'
import { ClusterOverviewPageContent } from './ClusterOverview/ClusterOverview'
import { ClustersSettingsPageContent } from './ClusterSettings/ClusterSettings'
import { HubOfHubsRoute } from 'hub-of-hubs-ui-components'

export const ClusterContext = createContext<{
    readonly cluster: Cluster | undefined
    readonly clusterCurator?: ClusterCurator
    readonly addons: Addon[] | undefined
    readonly clusterDeployment?: ClusterDeployment
    readonly agents?: CIM.AgentK8sResource[]
    readonly agentClusterInstall?: CIM.AgentClusterInstallK8sResource
    readonly infraEnv?: CIM.InfraEnvK8sResource
}>({
    cluster: undefined,
    addons: undefined,
    clusterDeployment: undefined,
    agents: undefined,
    agentClusterInstall: undefined,
    infraEnv: undefined,
})

export default function ClusterDetailsPage({ match }: RouteComponentProps<{ id: string }>) {
    const location = useLocation()
    const history = useHistory()
    const { t } = useTranslation(['cluster'])

    const [
        managedClusters,
        clusterDeployments,
        managedClusterInfos,
        certificateSigningRequests,
        managedClusterAddons,
        clusterManagementAddons,
        clusterClaims,
        clusterCurators,
        agentClusterInstalls,
        agents,
        infraEnvs,
        manifestWorks
    ] = useRecoilValue(
        waitForAll([
            managedClustersState,
            clusterDeploymentsState,
            managedClusterInfosState,
            certificateSigningRequestsState,
            managedClusterAddonsState,
            clusterManagementAddonsState,
            clusterClaimsState,
            clusterCuratorsState,
            agentClusterInstallsState,
            agentsState,
            infraEnvironmentsState,
            manifestWorksState
        ])
    )

    const managedCluster = managedClusters.find((mc) => mc.metadata.name === match.params.id)
    const clusterDeployment = clusterDeployments.find(
        (cd) => cd.metadata.name === match.params.id && cd.metadata.namespace === match.params.id
    )
    const managedClusterInfo = managedClusterInfos.find(
        (mci) => mci.metadata.name === match.params.id && mci.metadata.namespace === match.params.id
    )
    const clusterAddons = managedClusterAddons.filter((mca) => mca.metadata.namespace === match.params.id)
    const addons = mapAddons(clusterManagementAddons, clusterAddons)

    const clusterClaim = clusterClaims.find((cc) => cc.spec?.namespace === clusterDeployment?.metadata?.name)

    const clusterCurator = clusterCurators.find((cc) => cc.metadata.namespace === match.params.id)

    const agentClusterInstall = agentClusterInstalls.find(
        (aci) => aci.metadata.name === match.params.id && aci.metadata.namespace === match.params.id
    )
    const infraEnv = infraEnvs.find(
        (ie) =>
            ie.metadata.name === clusterDeployment?.metadata.name &&
            ie.metadata.namespace === clusterDeployment?.metadata.namespace
    )

    const mws = manifestWorks?.filter((mw) => mw.metadata?.namespace === match.params.id)

    const fromHierarchy = window?.localStorage?.getItem('isInfrastructureOpen') === 'true' ? true : false
    const [, setRoute] = useRecoilState(hubOfHubsRouteState)
    useEffect(() => {
        if (fromHierarchy) {
            setRoute(HubOfHubsRoute.HubClusters), [setRoute]
        } else {
            setRoute(HubOfHubsRoute.Clusters), [setRoute]
        }
    })

    const clusterExists = !!managedCluster || !!clusterDeployment || !!managedClusterInfo

    const cluster = getCluster(
        managedClusterInfo,
        clusterDeployment,
        certificateSigningRequests,
        managedCluster,
        clusterAddons,
        clusterClaim,
        clusterCurator,
        agentClusterInstall,
        mws
    )
    const prevCluster = usePrevious(cluster)
    const showMachinePoolTab = cluster.isHive && cluster.isManaged && cluster.provider !== Provider.baremetal

    const [canGetSecret, setCanGetSecret] = useState<boolean>(true)
    useEffect(() => {
        const canGetSecret = canUser('get', SecretDefinition, match.params.id)
        canGetSecret.promise
            .then((result) => setCanGetSecret(result.status?.allowed!))
            .catch((err) => console.error(err))
        return () => canGetSecret.abort()
    }, [match.params.id])

    if (
        (prevCluster?.isHive && prevCluster?.status === ClusterStatus.destroying) ||
        (!prevCluster?.isHive && prevCluster?.status === ClusterStatus.detaching)
    ) {
        return <ClusterDestroy isLoading={clusterExists} cluster={prevCluster!} />
    }

    if (!clusterExists) {
        return (
            <Page>
                <ErrorPage
                    error={new ResourceError('Not found', 404)}
                    actions={
                        <AcmButton role="link" onClick={() => history.push(NavigationPath.clusters)}>
                            {t('button.backToClusters')}
                        </AcmButton>
                    }
                />
            </Page>
        )
    }

    return (
        <ClusterContext.Provider
            value={{
                cluster,
                clusterCurator,
                addons,
                agentClusterInstall,
                agents,
                clusterDeployment,
                infraEnv,
            }}
        >
            <AcmPage
                hasDrawer
                header={
                    <AcmPageHeader
                        breadcrumb={
                            fromHierarchy ?
                            [
                                { text: t('hierarchicalClusters'), to: NavigationPath.hierarchyClusters },
                                { text: cluster.displayName!, to: '' },
                            ]
                            :
                            [
                                { text: t('clusters'), to: NavigationPath.clusters },
                                { text: cluster.displayName!, to: '' },
                            ]
                        }
                        title={cluster.displayName!}
                        description={
                            cluster.hive.clusterClaimName && (
                                <span style={{ color: 'var(--pf-global--Color--200)' }}>
                                    {cluster.hive.clusterClaimName}
                                </span>
                            )
                        }
                        navigation={
                            <AcmSecondaryNav>
                                <AcmSecondaryNavItem
                                    isActive={
                                        location.pathname === NavigationPath.clusterOverview.replace(':id', match.params.id) ||
                                        location.pathname === NavigationPath.hubClusterOverview.replace(':id', match.params.id)
                                    }
                                >
                                    <Link to={fromHierarchy ? NavigationPath.hubClusterOverview.replace(':id', match.params.id) : NavigationPath.clusterOverview.replace(':id', match.params.id)}>
                                        {t('tab.overview')}
                                    </Link>
                                </AcmSecondaryNavItem>
                                <AcmSecondaryNavItem
                                    isActive={
                                        location.pathname ===
                                        NavigationPath.clusterNodes.replace(':id', match.params.id)
                                    }
                                >
                                    <Link to={NavigationPath.clusterNodes.replace(':id', match.params.id)}>
                                        {t('tab.nodes')}
                                    </Link>
                                </AcmSecondaryNavItem>
                                {showMachinePoolTab && (
                                    <AcmSecondaryNavItem
                                        isActive={
                                            location.pathname ===
                                            NavigationPath.clusterMachinePools.replace(':id', match.params.id)
                                        }
                                    >
                                        <Link to={NavigationPath.clusterMachinePools.replace(':id', match.params.id)}>
                                            {t('tab.machinepools')}
                                        </Link>
                                    </AcmSecondaryNavItem>
                                )}
                                <AcmSecondaryNavItem
                                    isActive={
                                        location.pathname ===
                                        NavigationPath.clusterSettings.replace(':id', match.params.id)
                                    }
                                >
                                    <Link to={NavigationPath.clusterSettings.replace(':id', match.params.id)}>
                                        {t('tab.addons')}
                                    </Link>
                                </AcmSecondaryNavItem>
                            </AcmSecondaryNav>
                        }
                        actions={
                            <AcmActionGroup>
                                <AcmLaunchLink
                                    links={addons
                                        ?.filter((addon) => addon.launchLink)
                                        ?.map((addon) => ({
                                            id: addon.launchLink?.displayText!,
                                            text: addon.launchLink?.displayText!,
                                            href: addon.launchLink?.href!,
                                        }))}
                                />
                                <DownloadConfigurationDropdown canGetSecret={canGetSecret} />
                                <ClusterActionDropdown cluster={cluster!} isKebab={false} />
                            </AcmActionGroup>
                        }
                    />
                }
            >
                <Suspense fallback={<Fragment />}>
                    <Switch>
                        <Route exact path={NavigationPath.clusterOverview}>
                            <ClusterOverviewPageContent canGetSecret={canGetSecret} />
                        </Route>
                        <Route exact path={NavigationPath.hubClusterOverview}>
                            <ClusterOverviewPageContent canGetSecret={canGetSecret} />
                        </Route>
                        <Route exact path={NavigationPath.clusterNodes}>
                            <NodePoolsPageContent />
                        </Route>
                        {showMachinePoolTab && (
                            <Route exact path={NavigationPath.clusterMachinePools}>
                                <MachinePoolsPageContent />
                            </Route>
                        )}
                        <Route exact path={NavigationPath.clusterSettings}>
                            <ClustersSettingsPageContent />
                        </Route>
                        <Route exact path={NavigationPath.clusterDetails}>
                            <Redirect to={NavigationPath.clusterOverview.replace(':id', match.params.id)} />
                        </Route>
                        <Route exact path={NavigationPath.hubClusterDetails}>
                            <Redirect to={NavigationPath.hubClusterOverview.replace(':id', match.params.id)} />
                        </Route>
                    </Switch>
                </Suspense>
            </AcmPage>
        </ClusterContext.Provider>
    )
}
