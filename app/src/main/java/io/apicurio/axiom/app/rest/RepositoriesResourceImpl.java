package io.apicurio.axiom.app.rest;

import io.apicurio.axiom.api.RepositoriesResource;
import io.apicurio.axiom.api.beans.NewRepository;
import io.apicurio.axiom.api.beans.Repository;
import io.apicurio.axiom.core.entities.RepositoryEntity;
import io.smallrye.common.annotation.RunOnVirtualThread;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.WebApplicationException;

import java.util.List;

/**
 * Implementation of the Repositories REST API.
 */
@ApplicationScoped
@RunOnVirtualThread
public class RepositoriesResourceImpl implements RepositoriesResource {

    /**
     * {@inheritDoc}
     */
    @Override
    public List<Repository> listRepositories() {
        return RepositoryEntity.<RepositoryEntity>listAll()
                .stream()
                .map(this::toBean)
                .toList();
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    public Repository createRepository(NewRepository data) {
        RepositoryEntity entity = new RepositoryEntity();
        applyFields(entity, data);
        entity.persist();
        return toBean(entity);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public Repository getRepository(long repositoryId) {
        return toBean(findOrThrow(repositoryId));
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    public Repository updateRepository(long repositoryId, NewRepository data) {
        RepositoryEntity entity = findOrThrow(repositoryId);
        applyFields(entity, data);
        return toBean(entity);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    public void deleteRepository(long repositoryId) {
        RepositoryEntity entity = findOrThrow(repositoryId);
        entity.delete();
    }

    private void applyFields(RepositoryEntity entity, NewRepository data) {
        entity.name = data.getName();
        entity.owner = data.getOwner();
        entity.source = data.getSource().value();
        entity.url = data.getUrl();
        entity.pollInterval = data.getPollInterval();
        entity.webhookSecret = data.getWebhookSecret();
        entity.configuration = data.getConfiguration() != null ? data.getConfiguration().toString() : null;
        entity.pollingEnabled = data.getPollingEnabled() != null ? data.getPollingEnabled() : false;
    }

    private RepositoryEntity findOrThrow(long id) {
        RepositoryEntity entity = RepositoryEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Repository not found: " + id, 404);
        }
        return entity;
    }

    private Repository toBean(RepositoryEntity entity) {
        Repository repo = new Repository();
        repo.setId(entity.id);
        repo.setName(entity.name);
        repo.setOwner(entity.owner);
        repo.setSource(Repository.Source.fromValue(entity.source));
        repo.setUrl(entity.url);
        repo.setPollInterval(entity.pollInterval);
        repo.setWebhookSecret(entity.webhookSecret);
        repo.setPollingEnabled(entity.pollingEnabled);
        return repo;
    }
}
