# Proposal: GitHub Webhooks for Real-Time Event Delivery

**Status**: Draft
**Author**: Claude (with Eric Wittmann)
**Date**: 2026-02-12
**Version**: 1.0

## Executive Summary

This proposal outlines a plan to enhance Apicurio Axiom by adding support for GitHub webhooks as an alternative
or replacement for the current polling-based event system. The webhook approach provides real-time event delivery,
access to all GitHub event types (including discussion comments), and improved efficiency by eliminating wasteful
API polling.

**Key Benefits:**
- **Real-time event delivery** (< 1 second latency vs 0-15 second polling delay)
- **Complete event coverage** including `discussion_comment` events not available via polling
- **Reduced API usage** and elimination of rate limit concerns
- **Industry-standard GitHub integration pattern**

**Key Challenges:**
- Requires publicly accessible HTTP endpoint
- Increased infrastructure and deployment complexity
- Need for signature validation and security measures

## Current State: Polling Architecture

### How It Works

Apicurio Axiom currently polls the GitHub REST Events API at regular intervals (default: 15 seconds) to check for
new events.

```
┌─────────────────┐
│  Apicurio Axiom │
│                 │
│  ┌──────────┐   │      Poll every 15s
│  │  Poller  │───┼────────────────────► GET /repos/{owner}/{repo}/events
│  └────┬─────┘   │
│       │         │
│       ▼         │
│  ┌──────────┐   │
│  │ Processor│   │
│  └──────────┘   │
└─────────────────┘
```

**Implementation:**
- File: `src/github/poller.ts`
- API: `octokit.activity.listRepoEvents()`
- Endpoint: `GET /repos/{owner}/{repo}/events`

### Limitations

1. **Limited Event Types**
   - The REST Events API only returns a subset of GitHub events
   - **Missing**: `discussion_comment`, `discussion.edited`, many others
   - **Available**: Only `DiscussionEvent` (discussion created), not comments or edits

2. **Polling Inefficiency**
   - Constant API calls even when no events occur
   - 0-15 second latency before events are detected
   - Contributes to API rate limit consumption

3. **Scalability Concerns**
   - Each monitored repository requires separate polling
   - Multiple repositories multiply API call frequency

4. **Discovered Issue**
   - Configuration includes event mappings for `discussion_comment.created`
   - **These events never trigger** because polling API doesn't provide them
   - User expectations not met

### Why This Matters

**Example Scenario:**

```yaml
# Config includes this mapping
- event: discussion_comment.created
  actions:
    - ai-discuss
```

**Reality:**
1. User creates a discussion
2. User adds comments to the discussion
3. **Polling detects**: `DiscussionEvent` with action "created"
4. **Polling misses**: Comment events (not in Events API)
5. **Result**: AI never participates in discussion comments

## Proposed Solution: GitHub Webhooks

### Overview

GitHub webhooks are event-driven HTTP callbacks that GitHub sends to your server in real-time when events occur.

### How Webhooks Work

```
                              GitHub Repository
                                     │
                        Event occurs │ (e.g., comment created)
                                     ▼
                    ┌────────────────────────────┐
                    │   GitHub Webhook Service   │
                    └──────────┬─────────────────┘
                               │
                               │ HTTP POST
                               │ https://your-server.com/webhook
                               │
                               ▼
┌──────────────────────────────────────────────────────────┐
│                    Apicurio Axiom                        │
│                                                          │
│  ┌────────────────────────────────────────────────┐     │
│  │         HTTP Server (Express/Fastify)          │     │
│  │  Listens on: https://your-server.com/webhook   │     │
│  └─────────────────────┬──────────────────────────┘     │
│                        │                                 │
│                        ▼                                 │
│  ┌────────────────────────────────────────────────┐     │
│  │         Signature Validator                    │     │
│  │  Verify: X-Hub-Signature-256 header            │     │
│  └─────────────────────┬──────────────────────────┘     │
│                        │                                 │
│                        ▼                                 │
│  ┌────────────────────────────────────────────────┐     │
│  │         Event Normalizer                       │     │
│  │  Convert webhook payload → Event format        │     │
│  └─────────────────────┬──────────────────────────┘     │
│                        │                                 │
│                        ▼                                 │
│  ┌────────────────────────────────────────────────┐     │
│  │         Event Queue                            │     │
│  │  Queue for async processing                    │     │
│  └─────────────────────┬──────────────────────────┘     │
│                        │                                 │
│                        ▼                                 │
│  ┌────────────────────────────────────────────────┐     │
│  │         Event Processor (EXISTING)             │     │
│  │  Process events, trigger actions               │     │
│  └────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────┘
```

### Webhook Event Flow

1. **Event occurs** on GitHub (e.g., discussion comment created)
2. **GitHub sends HTTP POST** to configured webhook URL
3. **Axiom receives request** with event payload
4. **Validate signature** to ensure authenticity
5. **Respond with 202 Accepted** (within 10 seconds)
6. **Queue event** for asynchronous processing
7. **Process event** through existing event processor

### Example Webhook Payload

When a discussion comment is created:

```http
POST /webhook/github HTTP/1.1
Host: axiom.example.com
Content-Type: application/json
User-Agent: GitHub-Hookshot/abc123
X-GitHub-Event: discussion_comment
X-GitHub-Delivery: 12345678-1234-1234-1234-123456789012
X-Hub-Signature-256: sha256=abc123...

{
  "action": "created",
  "discussion": {
    "id": 123,
    "number": 39,
    "title": "Question about the FromNow component",
    "body": "How does this work?",
    "user": {
      "login": "EricWittmann"
    },
    "category": {
      "name": "Q&A"
    },
    "created_at": "2026-02-12T13:46:40Z",
    "html_url": "https://github.com/owner/repo/discussions/39"
  },
  "comment": {
    "id": 987654,
    "body": "This is my comment response",
    "user": {
      "login": "EricWittmann"
    },
    "created_at": "2026-02-12T13:50:15Z",
    "html_url": "https://github.com/owner/repo/discussions/39#discussioncomment-987654"
  },
  "repository": {
    "id": 12345,
    "name": "cb-test-project",
    "full_name": "EricWittmann/cb-test-project",
    "owner": {
      "login": "EricWittmann"
    }
  },
  "sender": {
    "login": "EricWittmann"
  }
}
```

## Comparison: Polling vs Webhooks

| Aspect | Polling (Current) | Webhooks (Proposed) |
|--------|------------------|---------------------|
| **Latency** | 0-15 seconds | < 1 second |
| **Event Coverage** | Limited (REST Events API) | **Complete** (all webhook events) |
| **Discussion Comments** | ❌ Not available | ✅ Available |
| **Discussion Edits** | ❌ Not available | ✅ Available |
| **API Usage** | High (constant polling) | Minimal (no polling) |
| **Rate Limits** | Consumes quota | No API calls |
| **Infrastructure** | Simple (runs anywhere) | Requires public endpoint |
| **Reliability** | Predictable polling | Depends on delivery success |
| **Development** | Easy (local testing) | Requires tunneling (ngrok) |
| **Production** | Less efficient | Industry standard |
| **Setup Complexity** | Low | Medium |
| **Security** | API token only | Signature validation required |

## Architecture Changes

### New Components

#### 1. Webhook HTTP Server

**File**: `src/github/webhook-server.ts`

**Responsibilities:**
- Listen for incoming HTTP POST requests from GitHub
- Validate webhook signatures using HMAC-SHA256
- Respond with 202 Accepted within 10 seconds
- Queue events for processing

**Dependencies:**
- HTTP framework: Express or Fastify
- Crypto library: Node.js built-in `crypto`
- Queue system: Existing or new queue implementation

#### 2. Webhook Configuration

**Config**: `config.yaml`

```yaml
# New webhook section
webhook:
  enabled: true
  port: 3000
  path: /github/events
  secret: ${WEBHOOK_SECRET}
  maxPayloadSize: 25MB  # GitHub limit
  timeout: 10000  # Must respond within 10s

# Existing github section (modified)
github:
  token: ${BOT_GITHUB_TOKEN}
  # Remove: pollInterval (no longer needed)
```

#### 3. Signature Validator

**File**: `src/github/webhook-validator.ts`

**Responsibilities:**
- Verify `X-Hub-Signature-256` header
- Compare HMAC signature of payload with header
- Prevent unauthorized webhook calls

**Implementation:**
```typescript
function validateSignature(
    payload: string,
    signature: string,
    secret: string
): boolean {
    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');
    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(digest)
    );
}
```

#### 4. Event Normalizer (Enhanced)

**File**: `src/github/event-normalizer.ts` (new) or enhance existing

**Responsibilities:**
- Convert webhook payload format to internal Event format
- Map webhook event types to internal event types
- Extract relevant fields (issue, discussion, comment, etc.)

**Mapping:**
```typescript
// Webhook header
X-GitHub-Event: discussion_comment
action: created

// Internal event type
event.type = "discussion_comment.created"
```

### Modified Components

#### 1. Event Processor (No Changes Required)

The existing `EventProcessor` in `src/events/event-processor.ts` should work without modification. It already:
- Receives normalized `Event` objects
- Validates against event mappings
- Triggers configured actions

#### 2. Main Application Entry Point

**File**: `src/index.ts`

**Changes:**
```typescript
// Current (polling mode)
const poller = new GitHubPoller(/* ... */);
await poller.start();

// Proposed (webhook mode)
if (config.webhook.enabled) {
    const webhookServer = new WebhookServer(/* ... */);
    await webhookServer.start(config.webhook.port);
} else {
    // Fallback to polling
    const poller = new GitHubPoller(/* ... */);
    await poller.start();
}
```

#### 3. State Manager (Minor Enhancement)

**File**: `src/state/state-manager.ts`

**Potential Changes:**
- May need to track webhook delivery IDs instead of event IDs
- Webhook delivery IDs come from `X-GitHub-Delivery` header

### Removed Components

#### 1. GitHub Poller (Optional Removal)

**File**: `src/github/poller.ts`

**Options:**
- **Option A**: Remove entirely if webhooks are always used
- **Option B**: Keep as fallback for repositories without webhook access
- **Recommendation**: Keep as fallback (dual-mode support)

## Implementation Plan

### Phase 1: Foundation (Week 1)

**Goal**: Basic webhook server that receives and validates events

**Tasks:**
1. Create `src/github/webhook-server.ts`
   - Set up Express/Fastify HTTP server
   - Create POST endpoint `/webhook/github`
   - Add request logging

2. Create `src/github/webhook-validator.ts`
   - Implement signature validation
   - Add unit tests

3. Update `config.yaml` schema
   - Add webhook configuration section
   - Update TypeScript types

4. Update `src/index.ts`
   - Add webhook server initialization
   - Keep polling as fallback

**Deliverables:**
- Working HTTP server that receives webhooks
- Signature validation
- Logs all incoming webhooks
- Unit tests for signature validation

### Phase 2: Event Processing (Week 2)

**Goal**: Convert webhook payloads to internal events and process them

**Tasks:**
1. Create `src/github/event-normalizer.ts`
   - Map webhook payloads to Event format
   - Handle all supported event types
   - Add comprehensive mapping tests

2. Integrate with EventProcessor
   - Queue webhook events
   - Process through existing workflow
   - Reuse existing action execution

3. Add event deduplication
   - Track processed webhook delivery IDs
   - Prevent duplicate processing

**Deliverables:**
- Webhook events processed like polling events
- Full integration with existing event processor
- Event deduplication

### Phase 3: Testing & Documentation (Week 3)

**Goal**: Test with real GitHub webhooks and document setup

**Tasks:**
1. Integration testing
   - Set up test repository
   - Configure GitHub webhook
   - Test all supported event types
   - Verify discussion_comment events work

2. Documentation
   - Update README with webhook setup
   - Create deployment guide
   - Document security best practices
   - Add troubleshooting guide

3. Error handling
   - Handle malformed payloads
   - Log failed signature validations
   - Add webhook delivery retry mechanism

**Deliverables:**
- Comprehensive integration tests
- Complete documentation
- Production-ready error handling

### Phase 4: Deployment & Migration (Week 4)

**Goal**: Deploy to production and migrate from polling

**Tasks:**
1. Infrastructure setup
   - Choose deployment platform
   - Configure domain and SSL
   - Set up monitoring

2. GitHub configuration
   - Configure webhooks on monitored repositories
   - Set webhook secrets
   - Test webhook delivery

3. Migration
   - Run webhook and polling in parallel
   - Verify event coverage
   - Disable polling after validation

**Deliverables:**
- Production deployment
- Webhooks configured on all repositories
- Polling deprecated/removed

## Security Considerations

### 1. Signature Validation (CRITICAL)

**Threat**: Malicious actors sending fake webhook payloads

**Mitigation:**
- **Always validate** `X-Hub-Signature-256` header
- Use constant-time comparison to prevent timing attacks
- Reject requests with invalid signatures (401 Unauthorized)

**Implementation:**
```typescript
const signature = req.headers['x-hub-signature-256'];
if (!signature || !validateSignature(body, signature, secret)) {
    return res.status(401).send('Invalid signature');
}
```

### 2. Webhook Secret Management

**Threat**: Secret exposure leading to signature bypass

**Mitigation:**
- Generate strong random secret: `openssl rand -hex 32`
- Store in environment variables, never in code
- Rotate periodically
- Use different secrets per repository if needed

**Example:**
```bash
# Generate secret
openssl rand -hex 32

# Store in environment
export WEBHOOK_SECRET="a1b2c3d4e5f6..."
```

### 3. HTTPS Required

**Threat**: Man-in-the-middle attacks intercepting webhook payloads

**Mitigation:**
- GitHub **requires HTTPS** for webhook URLs
- Use valid SSL/TLS certificate
- Configure proper certificate chain

**Options:**
- Let's Encrypt (free, automated)
- Cloud provider certificates (AWS ACM, Google-managed)
- Cloudflare SSL

### 4. Rate Limiting

**Threat**: Denial of service via webhook flooding

**Mitigation:**
- Implement rate limiting on webhook endpoint
- Set maximum payload size (25MB per GitHub)
- Add IP allowlisting for GitHub webhook IPs

**Implementation:**
```typescript
import rateLimit from 'express-rate-limit';

const webhookLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,  // 1 minute
    max: 100,  // Max 100 requests per minute
    message: 'Too many webhook requests'
});

app.post('/webhook/github', webhookLimiter, handleWebhook);
```

### 5. Input Validation

**Threat**: Malformed payloads causing crashes or vulnerabilities

**Mitigation:**
- Validate webhook payload structure
- Sanitize all user-provided data
- Use TypeScript types for type safety
- Validate `X-GitHub-Event` header against allowlist

### 6. Logging & Monitoring

**Security Value:**
- Detect unusual webhook patterns
- Identify failed validation attempts
- Audit trail for security incidents

**Implementation:**
- Log all webhook deliveries with delivery ID
- Log signature validation failures
- Monitor for suspicious patterns
- Alert on repeated failures

## Deployment Options

### Option 1: Cloud Platform with Public URL

**Platforms:**
- AWS: EC2, ECS, Lambda + API Gateway
- Google Cloud: Cloud Run, Cloud Functions
- Azure: App Service, Azure Functions
- DigitalOcean: Droplets, App Platform

**Pros:**
- Managed infrastructure
- Automatic SSL certificates
- Built-in monitoring and logging
- High availability

**Cons:**
- Ongoing costs
- Platform-specific configuration
- May require infrastructure expertise

**Example (Google Cloud Run):**
```bash
# Build container
docker build -t axiom .

# Push to registry
docker push gcr.io/project/axiom

# Deploy
gcloud run deploy axiom \
  --image gcr.io/project/axiom \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated

# Webhook URL: https://axiom-xxxxx-uc.a.run.app/webhook/github
```

### Option 2: Self-Hosted with Domain

**Requirements:**
- Server with public IP
- Domain name
- SSL certificate (Let's Encrypt)
- Reverse proxy (nginx/Caddy)

**Pros:**
- Full control
- One-time hardware cost
- No vendor lock-in

**Cons:**
- Maintenance overhead
- Manual SSL renewal
- Requires sysadmin skills
- Single point of failure

**Example Setup:**
```nginx
# nginx configuration
server {
    listen 443 ssl http2;
    server_name axiom.example.com;

    ssl_certificate /etc/letsencrypt/live/axiom.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/axiom.example.com/privkey.pem;

    location /webhook/github {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Option 3: Cloudflare Tunnel (Free)

**How it works:**
- Free tunnel service from Cloudflare
- No open ports required
- Automatic SSL
- DDoS protection included

**Pros:**
- Completely free
- No public IP needed
- Enterprise-grade DDoS protection
- Easy setup

**Cons:**
- Dependent on Cloudflare
- Requires Cloudflare account
- Learning curve for tunnel setup

**Setup:**
```bash
# Install cloudflared
brew install cloudflare/cloudflare/cloudflared

# Authenticate
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create axiom

# Configure routing
cloudflared tunnel route dns axiom axiom.example.com

# Run tunnel
cloudflared tunnel run axiom

# Webhook URL: https://axiom.example.com/webhook/github
```

### Option 4: Development/Testing with ngrok

**Use case**: Local development and testing

**Pros:**
- No deployment needed
- Perfect for testing
- Easy to start/stop

**Cons:**
- Not for production
- URL changes on restart (free tier)
- Rate limits on free tier

**Setup:**
```bash
# Start Axiom locally
npm start

# In another terminal
ngrok http 3000

# Use ngrok URL in GitHub webhook
# https://abc123.ngrok.io/webhook/github
```

### Recommendation

**For Production**: Cloud Run or App Service
**For Development**: ngrok or Cloudflare Tunnel
**For Self-Hosted**: VPS with Caddy (automatic HTTPS)

## Migration Strategy

### Approach: Dual-Mode Support

Support both webhook and polling modes simultaneously, allowing gradual migration.

### Configuration

```yaml
# config.yaml
mode: webhook  # or "polling" or "hybrid"

webhook:
  enabled: true
  port: 3000
  secret: ${WEBHOOK_SECRET}

github:
  token: ${BOT_GITHUB_TOKEN}
  pollInterval: 15  # Used when mode=polling or as fallback
```

### Migration Steps

#### Step 1: Parallel Operation (Week 1)

- Deploy webhook server
- Keep polling active
- Both systems running simultaneously
- Compare event detection

**Validation:**
- Verify webhook events arrive
- Confirm no duplicate processing
- Check event coverage

#### Step 2: Monitoring (Week 2)

- Monitor webhook delivery success rate
- Track event types from both sources
- Identify any gaps or issues

**Metrics to track:**
- Webhook delivery latency
- Signature validation failures
- Event processing success rate
- Comparison with polling events

#### Step 3: Cutover (Week 3)

- Set `mode: webhook` in config
- Polling becomes fallback only
- Monitor for issues

**Rollback plan:**
- Can quickly switch back to `mode: polling`
- Keep polling code intact for 1 month

#### Step 4: Cleanup (Week 4)

- Remove polling code (optional)
- Archive polling documentation
- Update all documentation to webhook-first

### Rollback Plan

If webhooks prove unreliable:

1. **Immediate**: Change `mode: polling` in config, restart
2. **Short-term**: Keep both systems running in hybrid mode
3. **Long-term**: Address webhook issues, retry migration

## Risks & Mitigation

### Risk 1: Webhook Delivery Failures

**Likelihood**: Medium
**Impact**: High

**Scenarios:**
- GitHub unable to reach webhook endpoint
- Server downtime during event
- Network issues

**Mitigation:**
- GitHub retries failed deliveries (up to 3 days)
- Implement webhook replay mechanism
- Monitor delivery success rate
- Keep polling as fallback option

### Risk 2: Infrastructure Complexity

**Likelihood**: High
**Impact**: Medium

**Scenarios:**
- SSL certificate expiration
- DNS issues
- Server misconfiguration

**Mitigation:**
- Use cloud platform with auto-renewing certificates
- Implement comprehensive monitoring
- Document all infrastructure setup
- Automate deployment with IaC

### Risk 3: Security Vulnerabilities

**Likelihood**: Low
**Impact**: Critical

**Scenarios:**
- Signature validation bypass
- Injection attacks via payloads
- Secret exposure

**Mitigation:**
- Comprehensive security review
- Penetration testing
- Regular secret rotation
- Security-focused code review

### Risk 4: Event Processing Bottlenecks

**Likelihood**: Medium
**Impact**: Medium

**Scenarios:**
- High event volume overwhelming processor
- Long-running actions blocking queue
- Memory/CPU exhaustion

**Mitigation:**
- Implement proper async queue
- Set max concurrent action limit
- Add event processing metrics
- Scale horizontally if needed

## Cost Analysis

### Polling (Current)

**API Costs:**
- 5,760 API calls per day (15-second interval, single repo)
- Free tier: 5,000 requests/hour (sufficient)
- Cost: $0

**Infrastructure:**
- Can run on any machine
- No special requirements
- Cost: $0

**Total**: $0/month

### Webhooks (Proposed)

**API Costs:**
- Minimal (only for action execution)
- Cost: $0

**Infrastructure:**

**Option A: Cloud Run (Recommended)**
- 2M requests free per month
- Estimated: 10,000 events/month
- CPU/Memory: Minimal (only webhook receipt)
- **Cost: $0-5/month**

**Option B: Cloudflare Tunnel**
- Free tunnel service
- Self-hosted server for Axiom
- **Cost: $0 (tunnel) + server costs**

**Option C: VPS (DigitalOcean, etc.)**
- Basic Droplet: $4-6/month
- Includes compute + public IP
- **Cost: $4-6/month**

**Total**: $0-6/month (comparable to polling)

## Recommendations

### Immediate Action: Document Limitation

**Priority**: High
**Effort**: Low

Update documentation to clarify that `discussion_comment` events are **not supported** with the current polling
architecture.

**Files to update:**
- `README.md`: Add limitations section
- `docs/EventMappings.md`: Note polling limitations
- `docs/Actions.md`: Clarify discussion event coverage

**Example:**
```markdown
## Known Limitations (Polling Mode)

The following GitHub events are NOT available when using polling mode:
- `discussion_comment.*` - Discussion comments (create, edit, delete)
- `discussion.edited` - Discussion edits
- Many other webhook-only events

To receive these events, webhook mode must be configured.
```

### Short-Term: Implement Webhooks

**Priority**: High
**Effort**: Medium

Implement webhook support following the phased plan outlined above.

**Timeline**: 4 weeks
**Resources**: 1 developer, part-time

**Success Criteria:**
- Webhook server receives and validates events
- Discussion comment events trigger configured actions
- Production deployment successful
- Documentation complete

### Long-Term: Deprecate Polling

**Priority**: Medium
**Effort**: Low

After successful webhook deployment and validation:

**6 months after webhook deployment:**
- Mark polling mode as deprecated
- Update documentation
- Encourage webhook migration

**12 months after webhook deployment:**
- Consider removing polling code
- Webhooks become the only supported mode

### Alternative: Accept Limitation

**Priority**: N/A
**Effort**: None

If webhook infrastructure is not feasible, accept that discussion comments are not supported.

**Actions:**
- Remove `discussion_comment` event mappings from examples
- Document clearly in all relevant places
- Focus on events that ARE supported via polling

## Conclusion

GitHub webhooks provide a superior event delivery mechanism compared to polling, offering real-time delivery,
complete event coverage including discussion comments, and improved efficiency. While webhooks require additional
infrastructure (public HTTP endpoint), this is the industry-standard approach used by virtually all GitHub
integrations.

### Recommended Path Forward

1. **Immediate** (This week):
   - Document polling limitations
   - Remove misleading `discussion_comment` examples from config

2. **Short-term** (Next month):
   - Implement webhook server
   - Deploy to cloud platform (Cloud Run recommended)
   - Test with real webhooks
   - Update documentation

3. **Medium-term** (3-6 months):
   - Run webhooks in production
   - Monitor reliability and performance
   - Deprecate polling mode

4. **Long-term** (12 months):
   - Webhooks as primary/only mode
   - Remove polling code
   - Simplified codebase

### Success Metrics

- **Functionality**: Discussion comment events successfully trigger actions
- **Performance**: < 2 second end-to-end latency (event → action start)
- **Reliability**: > 99% webhook delivery success rate
- **Efficiency**: Zero unnecessary API calls from polling

### Next Steps

If approved, the first concrete step is:

1. Choose deployment platform (recommend: Google Cloud Run)
2. Set up infrastructure (domain, SSL, deployment)
3. Begin Phase 1 implementation (webhook server foundation)

---

## Appendix

### A. Example GitHub Webhook Configuration

```yaml
# Repository Settings → Webhooks → Add webhook

Payload URL: https://axiom.example.com/webhook/github
Content type: application/json
Secret: [Generated with: openssl rand -hex 32]

Which events would you like to trigger this webhook?
☑ Let me select individual events
  ☑ Discussions
  ☑ Discussion comments
  ☑ Issues
  ☑ Issue comments
  ☑ Pull requests
  ☑ Pull request reviews
  ☑ Pull request review comments
  ☑ Pushes
  ☑ Releases

☑ Active
```

### B. Environment Variables

```bash
# .env file
BOT_GITHUB_TOKEN=ghp_xxxxxxxxxxxx
WEBHOOK_SECRET=a1b2c3d4e5f6789012345678901234567890123456789012345678901234
WEBHOOK_PORT=3000
```

### C. Example Webhook Server Code

```typescript
// src/github/webhook-server.ts (simplified example)

import express from 'express';
import { validateSignature } from './webhook-validator.js';
import { EventProcessor } from '../events/event-processor.js';

export class WebhookServer {
    private app: express.Application;
    private secret: string;
    private eventProcessor: EventProcessor;

    constructor(secret: string, eventProcessor: EventProcessor) {
        this.secret = secret;
        this.eventProcessor = eventProcessor;
        this.app = express();
        this.setupRoutes();
    }

    private setupRoutes(): void {
        // Parse JSON body
        this.app.use(express.json({ limit: '25mb' }));

        // Health check
        this.app.get('/health', (req, res) => {
            res.status(200).send('OK');
        });

        // Webhook endpoint
        this.app.post('/webhook/github', async (req, res) => {
            try {
                // 1. Validate signature
                const signature = req.headers['x-hub-signature-256'] as string;
                const payload = JSON.stringify(req.body);

                if (!validateSignature(payload, signature, this.secret)) {
                    return res.status(401).send('Invalid signature');
                }

                // 2. Respond immediately (within 10 seconds)
                res.status(202).send('Accepted');

                // 3. Process asynchronously
                const eventType = req.headers['x-github-event'] as string;
                const deliveryId = req.headers['x-github-delivery'] as string;

                await this.processWebhook(eventType, req.body, deliveryId);
            } catch (error) {
                console.error('Webhook processing error:', error);
                // Already responded, just log error
            }
        });
    }

    private async processWebhook(
        eventType: string,
        payload: any,
        deliveryId: string
    ): Promise<void> {
        // Convert to internal event format
        const event = {
            id: deliveryId,
            type: `${eventType}.${payload.action}`,
            repository: payload.repository.full_name,
            payload: payload,
            // ... other fields
        };

        // Process through existing event processor
        await this.eventProcessor.process(event);
    }

    async start(port: number): Promise<void> {
        this.app.listen(port, () => {
            console.log(`Webhook server listening on port ${port}`);
        });
    }
}
```

### D. References

- [GitHub Webhooks Documentation](https://docs.github.com/en/webhooks)
- [Webhook Events and Payloads](https://docs.github.com/en/webhooks/webhook-events-and-payloads)
- [Creating Webhooks](https://docs.github.com/en/webhooks/using-webhooks/creating-webhooks)
- [Handling Webhook Deliveries](https://docs.github.com/en/webhooks/using-webhooks/handling-webhook-deliveries)
- [Best Practices for Webhooks](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks)
- [Validating Webhook Deliveries](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)
