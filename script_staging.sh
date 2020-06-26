    docker build --pull -t "$CI_REGISTRY_IMAGE":"$CI_COMMIT_BRANCH"-"$CI_COMMIT_SHORT_SHA" .
    docker push "$CI_REGISTRY_IMAGE"