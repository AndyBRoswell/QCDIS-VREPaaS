import React, {useEffect, useState} from "react";
import getConfig from "next/config";
import {VLab} from "../types/vlab";
import {useSession} from "next-auth/react";

type Props = {
  vlab: VLab,
  slug: string | string[] | undefined,
}

interface VLabInstance {
  vlab: string,
  username: string,
}

const VLabInstances: React.FC<Props> = ({vlab, slug}) => {

  const {publicRuntimeConfig} = getConfig()

  const session = useSession()

  const [vlabInstances, setVlabInstances] = useState<Array<VLabInstance>>([])
  const [backendError, setBackendError] = useState(false)
  const [hideInstance, setHideInstance] = useState(false)

  const registerInstance = async () => {
    if (
      hideInstance
      || (session.status != "authenticated")
    ) {
      return
    }

    const username = session.data.user?.name

    const requestOptions: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        "vlab": slug,
        "username": username,
      }),
    }

    const apiUrl = `${window.location.origin}/${publicRuntimeConfig.apiBasePath}`
    return fetch(`${apiUrl}/vlab_instances/`, requestOptions);
  }

  const fetchVlabInstances = async () => {

    const apiUrl = `${window.location.origin}/${publicRuntimeConfig.apiBasePath}`
    const res = await fetch(`${apiUrl}/vlab_instances/?vlab_slug=${slug}`);
    try {
      const dat = await res.json()
      setVlabInstances(dat)
    } catch (e) {
      console.log(e)
      setBackendError(true)
    }
  }

  useEffect(() => {
    if (slug) {
      Promise.all([fetchVlabInstances()])
    }
  }, [slug]);

  return (
    <div className="space-y-4">
      <p className="text-2xl font-sans">Instances</p>
      {backendError || (
        <>
          <p>
            {vlabInstances.length} instance{vlabInstances.length != 1 && "s"}
          </p>
          <ul
            className="flex flex-wrap"
          >
            {vlabInstances.map((vlab_instance) => {
              return (
                <li
                  key={vlab_instance.username}
                  className="rounded-full m-1 px-2 bg-quinary text-onTertiary"
                >
                  {vlab_instance.username}
                </li>
              )
            })}
          </ul>
          <div className="space-y-4 pt-4">
            <div className="space-x-2">
              <input
                type="checkbox"
                name="hideInstance"
                checked={hideInstance}
                onChange={
                  (e) => {
                    setHideInstance(e.target.checked)
                  }
                }
              />
              <label className="text-sm">
                Hide my instance from this list
              </label>
            </div>
            <div>
              <a
                target="blank"
                href={vlab.endpoint}
                onClick={registerInstance}
              >
                <button
                  className="bg-primary hover:bg-primaryDark text-onPrimary font-bold py-2 px-4 rounded"
                >
                  Launch my instance
                </button>
              </a>
            </div>
          </div>

        </>
      )}
    </div>
  )
}

export default VLabInstances
