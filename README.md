> [!IMPORTANT]
> NaaVRE has been rewritten and migrated to the [NaaVRE](https://github.com/NaaVRE) organization. This repository is an archive of the legacy implementation. 
>
> Quick links to the new NaaVRE:
> * [Issues](https://github.com/NaaVRE/NaaVRE/issues)
> * [Architecture](https://github.com/NaaVRE/NaaVRE-architecture)
> * [Full repos list](https://github.com/NaaVRE/.github/blob/main/profile/README.md)

# VREPaaS


## Development environment

This project is using Django rest framework for the API, and Next.js for the frontend.

### Install Anaconda

Install Anaconda from these instructions: https://linuxize.com/post/how-to-install-anaconda-on-ubuntu-20-04/

Close the terminal and start a new one to activate conda.

### Dependencies

Create and activate conda environment:

```shell
conda env update --file environment.yaml
```

#### Install GitGuardian pre-commit hook

```
pre-commit install
ggshield auth login
```

#### Install tilt
Install [tilt](https://docs.tilt.dev/install.html) via conda

```shell
conda install -c conda-forge tilt
```

#### Install minikube

```shell
conda install -c conda-forge minikube
```

Follow step 3 section 'Linux OS with Network Manager' of the [minikube ingress-dns setup guide](https://minikube.sigs.k8s.io/docs/handbook/addons/ingress-dns/).


### Add secrets

Create `tilt/helm-values-secrets.yaml` and fill-in the following:

```yaml
global:
  keycloak:
    url:
    realm:
    client_id:
    client_secret_key:

  argo:
    namespace:
    url:
    token:
```

Create `tilt/helm-n-a-a-vre-secrets.yaml` and fill:

```yaml
hub:
  config:
    GenericOAuthenticator:
      client_id:
      client_secret:
      authorize_url:
      token_url:
      userdata_url:

singleuser:
  extraEnv:
    NAAVRE_API_TOKEN:
    SEARCH_API_ENDPOINT:
    SEARCH_API_TOKEN:
    CELL_GITHUB_TOKEN:
```


### Start Cluster

```shell
minikube start
minikube addons enable ingress
minikube addons enable ingress-dns
minikube dashboard  # optional
```

### Run tilt

```shell
tilt up
```

### Troubleshooting

#### Context deadline exceeded when pulling NaaVRE image

If you get `Failed to pull image "qcdis/n-a-a-vre-laserfarm:v2.0-beta": rpc error: code = Unknown desc = context deadline exceeded` in the `continuous-image-puller` logs:

- Reset the cluster (`minikube delete` and re-run the startup commands)
- Run `minikube image load qcdis/n-a-a-vre-laserfarm:v2.0-beta` in your terminal
- Run tilt



## API Admin

To add/remove resources go to: https://paas.minikube.test/vre-api-test/admin/

### Admin Credentials

The admin credentials are read from Helm values (e.g. `tilt/helm-values-dev.yaml`), with the key `vreapi.auth.superuser_{username,password}`.



## Argo Workflows

### Generate Token

```shell
kubectl apply -f - <<EOF
kind: Role
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: vre-api
  namespace: argo
rules:
  - verbs:
      - get
      - watch
      - patch
      - delete
    apiGroups:
      - ''
    resources:
      - pods
  - verbs:
      - get
      - watch
      - patch
    apiGroups:
      - ''
    resources:
      - pods/log
  - verbs:
      - create
    apiGroups:
      - ''
    resources:
      - pods/exec
  - verbs:
      - list
      - watch
      - create
      - get
      - update
      - delete
    apiGroups:
      - argoproj.io
    resources:
      - workflowtasksets
      - workflowartifactgctasks
      - workflowtemplates
      - workflows
      - cronworkflows
  - verbs:
      - patch
    apiGroups:
      - argoproj.io
    resources:
      - workflowtasksets/status
      - workflowartifactgctasks/status
      - workflows/status
EOF
```

```shell
kubectl create sa vre-api -n argo
```

```shell
kubectl create rolebinding vre-api --role=vre-api --serviceaccount=argo:vre-api -n argo
```

```shell
kubectl apply -f - <<EOF
apiVersion: v1
kind: Secret
metadata:
  namespace: argo
  name: vre-api.service-account-token
  annotations:
    kubernetes.io/service-account.name: vre-api
type: kubernetes.io/service-account-token
EOF
```

```shell
ARGO_TOKEN="Bearer $(kubectl get secret vre-api.service-account-token -n argo -o=jsonpath='{.data.token}' | base64 --decode)"
```

```shell
echo -n $ARGO_TOKEN | base64 -w 0
```

## Authorization

### Token

1. Create a user in the Django admin panel
2. Create a token for the user in the Django admin panel
3. Use the token in the header of the request

```python
resp = requests.get(
    f"{api_endpoint}/api/workflows/",
    headers={
        'Authorization': 'Token '+ naavre_api_token
    }
)
```

### Test Submit Workflow

```shell
curl -X POST "http://paas.minikube.test/vre-api-test/api/workflows/submit/" -H "Authorization: Token ${accessToken}" -H "Content-Type: application/json" -d "@vreapis/tests/resources/workflows/submit_workflow_req_body.json"
```


## Releases

If we want to add a new release environment we need to add a new .env.{ENV_NAME} together with a new line in the matrix
on the .workflows/make.yaml and .workflows/make-release.yaml
