/* Copyright Contributors to the Open Cluster Management project */

import { IResource, patchNonk8sResource } from '../../../../../resources'
import {
    AcmAlertContext,
    AcmAlertGroup,
    AcmForm,
    AcmLabelsInput,
    AcmModal,
    AcmSubmit,
} from '@open-cluster-management/ui-components'
import { ActionGroup, Button, ModalVariant } from '@patternfly/react-core'
import { useLayoutEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getErrorInfo } from '../../../../../components/ErrorPage'

export function EditLabels(props: { resource?: IResource; displayName?: string; close: () => void }) {
    const { t } = useTranslation(['cluster', 'common'])
    const [labels, setLabels] = useState<Record<string, string>>({})

    useLayoutEffect(() => {
        /* istanbul ignore next */
        const labels = props.resource?.metadata?.labels ?? {}
        setLabels({ ...labels })
    }, [props.resource?.metadata?.labels])

    return (
        <AcmModal
            title={t('labels.edit.title')}
            isOpen={props.resource !== undefined}
            variant={ModalVariant.medium}
            onClose={props.close}
        >
            <AcmAlertContext.Consumer>
                {(alertContext) => (
                    <AcmForm style={{ gap: 0 }}>
                        <div>{t('labels.description')}</div>
                        &nbsp;
                        <AcmLabelsInput
                            id="labels-input"
                            label={t('labels.lower', {
                                resourceName: props.displayName ?? props.resource?.metadata?.name,
                            })}
                            buttonLabel={t('labels.button.add')}
                            value={labels}
                            onChange={(labels) => setLabels(labels!)}
                            placeholder={t('labels.edit.placeholder')}
                        />
                        <AcmAlertGroup isInline canClose />
                        <ActionGroup>
                            <AcmSubmit
                                id="add-labels"
                                variant="primary"
                                onClick={() => {
                                    alertContext.clearAlerts()
                                    const resource: IResource = {
                                        apiVersion: props.resource!.apiVersion,
                                        kind: props.resource!.kind,
                                        metadata: {
                                            name: props.resource!.metadata!.name,
                                            labels: props.resource!.metadata!.labels,
                                        },
                                    }
                                    let patch: { op: string; path: string; value?: unknown }[] = []

                                    let deletePatchMap: Map<string, {op: string; path: string; value?: unknown}> = new Map()

                                    /* istanbul ignore else */
                                    if (resource!.metadata!.labels) {
                                        Object.keys(resource!.metadata!.labels).forEach((key) => {
                                            key = key.replace(/\//g, '~1')
                                            deletePatchMap.set(key, {
                                                op: 'remove',
                                                path: `/metadata/labels/${key}`,
                                            })
                                        })
                                    }

                                    let addPatchMap: Map<string, {op: string; path: string; value?: unknown}> = new Map()
                                    Object.keys(labels).forEach((key) => {
                                        const keyPath = key.replace(/\//g, '~1')
                                        /* delete from deletePatchMap if still exists */
                                        if (deletePatchMap.has(keyPath)) {
                                            deletePatchMap.delete(keyPath)
                                        } else { // add to addPatchMap only if was not consumed in unsetting a delete
                                            addPatchMap.set(keyPath, {
                                                op: 'add',
                                                path: `/metadata/labels/${keyPath}`,
                                                value: labels[key],
                                            })
                                        }
                                    })

                                    /* update patch to hold surviving deletes + surviving adds */
                                    deletePatchMap.forEach((value, _) => patch.push(value))
                                    addPatchMap.forEach((value, _) => patch.push(value))

                                    if (resource!.metadata?.labels === undefined) {
                                        patch.unshift({
                                            op: 'add',
                                            path: '/metadata/labels',
                                            value: {},
                                        })
                                    }

                                    return patchNonk8sResource(resource!, patch)
                                        .promise.then(() => {
                                            props.close()
                                        })
                                        .catch((err) => {
                                            const errorInfo = getErrorInfo(err)
                                            alertContext.addAlert({
                                                type: 'danger',
                                                title: errorInfo.title,
                                                message: errorInfo.message,
                                            })
                                        })
                                }}
                                label={t('common:save')}
                                processingLabel={t('common:saving')}
                            />
                            <Button variant="link" onClick={props.close}>
                                {t('common:cancel')}
                            </Button>
                        </ActionGroup>
                    </AcmForm>
                )}
            </AcmAlertContext.Consumer>
        </AcmModal>
    )
}
