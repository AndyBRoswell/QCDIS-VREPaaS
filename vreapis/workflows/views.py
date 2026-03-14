import logging

from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from services.argo import ArgoWorkflow
from services.k8s_secret_creator import K8sSecretCreator
from virtual_labs.models import VirtualLab
from vreapis.views import GetSerializerMixin

from . import models, serializers

logger = logging.getLogger(__name__)
FORMAT = "[%(filename)s:%(lineno)s - %(funcName)20s() ] %(message)s"
logging.basicConfig(format=FORMAT)


class WorkflowViewSet(GetSerializerMixin,
                      mixins.RetrieveModelMixin,
                      mixins.UpdateModelMixin,
                      mixins.ListModelMixin,
                      viewsets.GenericViewSet):
    queryset = models.Workflow.objects.all()
    serializer_class = serializers.WorkflowSerializer
    serializer_action_classes = {
        'list': serializers.WorkflowSerializer
        }

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            permission_classes = []
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    @staticmethod
    def _update_workflows(instances, new_properties):
        """ Update workflows from the db with properties retrieved from argo

        :param instances: list of Workflow objects from the db
        :param new_properties: list of serialized workflows
        """
        logger.debug('_update_workflows -------------------------------------')
        logger.debug(f'_update_workflows instances: {instances}')
        logger.debug(f'_update_workflows new_properties: {new_properties}')
        wf_serializer = serializers.WorkflowSerializer(
            instances,
            data=new_properties,
            partial=True,
            many=True,
            )

        if wf_serializer.is_valid(raise_exception=True):
            logger.debug("Serializer is valid")
            wf_serializer.save()

    def get_queryset(self):
        logger.debug('----------------get_queryset-------------------------')
        query_params = self.request.query_params
        logger.debug('get_queryset query_params: ' + str(query_params))
        vlab_slug = query_params.get('vlab_slug', None)
        vlab_query_set = VirtualLab.objects.filter(slug=vlab_slug)

        if vlab_slug:
            if vlab_query_set.exists():
                vlab = vlab_query_set.get()
                return models.Workflow.objects.filter(vlab=vlab.id)

        else:
            return models.Workflow.objects.all()

    def retrieve(self, request, *args, pk=None, **kwargs):
        logger.debug('retrieve ----------------------------------------------')
        workflow = ArgoWorkflow().retrieve_workflow(pk)
        if workflow is not None:
            self._update_workflows([self.get_object()], [workflow])
        return super().retrieve(self, request, *args, **kwargs)

    def list(self, request, *args, **kwargs):
        logger.debug('list --------------------------------------------------')
        vlab_slug = self.request.query_params.get('vlab_slug', None)
        workflows = ArgoWorkflow().list_workflows(vlab_slug)
        if workflows is not None:
            self._update_workflows(self.get_queryset(), workflows)
        return super().list(self, request, *args, **kwargs)

    @action(detail=False, methods=['POST'], name='Submit a workflow')
    def submit(self, request, *args, **kwargs):
        workflow = request.data.get('workflow_payload', None)
        vlab_slug = request.data.get('vlab', None)
        if not workflow:
            return Response(
                {'message': '"workflow_payload" not set'},
                status=400)
        # Note: vlab is unused, but still validated to not change the API spec.
        # workflow_payload.workflow.metadata.labels.vlab_slug is used instead.
        # They are set to the same value in NaaVRE ExecuteWorkflowHandler.post.
        if not vlab_slug:
            return Response(
                {'message': '"vlab" not set'},
                status=400)

        logger.debug('submitted workflow: ' + str(workflow))
        workflow, argo_response = ArgoWorkflow().submit_workflow(workflow)
        logger.debug('created workflow: ' + str(workflow))

        if not workflow:
            return Response(
                {
                    'message': 'Could not submit workflow',
                    'argo_response': argo_response,
                    'workflow': workflow,
                    },
                status=500)

        new_workflow = serializers.WorkflowSerializer(data=workflow)
        if new_workflow.is_valid(raise_exception=True):
            new_workflow.save()
        else:
            return Response(
                {
                    'message': 'Could not save workflow',
                    'argo_response': argo_response,
                    'workflow': workflow,
                    },
                status=500)

        return Response(new_workflow.data)

    @action(detail=False, methods=['POST'], name='Create a workflow secret')
    def create_secret(self, request, *args, **kwargs):
        try:
            return Response(K8sSecretCreator().create_secret(request.data))
        except Exception as e:
            return Response(
                {
                    'message': 'Could not create secret',
                    },
                status=500)
