import { createCampaignExport, readCampaignExport, trainingConsent } from './campaign-training.mjs';
import { campaignEarnings } from './campaign-escrow.mjs';
import { idempotencyRecord } from './idempotency.mjs';
import { missing } from './pilot-policy.mjs';
import {
  campaignReport, campaignView, changeCampaign, contributorTransition, listAssignments, ownCampaign,
  refreshCampaigns, reviewSubmission, saveCampaign, sendSubmission, signedAssignmentReceipt,
} from './campaigns.mjs';
import { appealQualification, qualificationAppeals, qualificationView, submitQualification } from './qualifications.mjs';

const personResources = ['qualifications', 'assignments', 'campaign-earnings'];

export function isCampaignRoute(route) {
  return ['campaigns', 'assignments', 'qualification-appeals'].includes(route[0]) ||
    (route[0] === 'me' && personResources.includes(route[1]));
}

export function campaignRoute(state, user, route, method, input, config, now, requestKey) {
  refreshCampaigns(state, now);
  const [resource, id, operation, suffix] = route;
  if (resource === 'qualification-appeals') {
    missing(config.pilot.reviewerIds.has(user.id), 'Qualification appeal');
    if (method === 'GET' && !id) return qualificationAppeals(state, user, null, null, now);
    if (method === 'POST' && id && operation === 'review' && !suffix) return qualificationAppeals(state, user, id, input, now);
  }
  if (resource === 'campaigns') {
    if (!id && method === 'GET') {
      return { campaigns: Object.values(state.campaigns).filter(entry => entry.ownerId === user.id)
        .slice(-50).reverse().map(campaignView), fundingNetwork: config.campaignChain?.network ?? null };
    }
    if (!id && method === 'POST') {
      const record = idempotencyRecord({ state, user, route: 'campaigns', rawKey: requestKey, body: input,
        now, secret: config.idempotencySecret });
      if (record.previousId) return { campaign: campaignView(ownCampaign(state, user, record.previousId)) };
      const result = saveCampaign(state, user, input, config, now);
      record.store(result.campaign.id);
      return result;
    }
    if (id && !operation && method === 'GET') return { campaign: campaignView(ownCampaign(state, user, id)) };
    if (id && operation === 'exports') {
      if (!suffix && method === 'POST') return createCampaignExport(state, user, id, input, now);
      if (suffix && method === 'GET') return readCampaignExport(state, user, id, suffix, now);
    }
    if (id && !operation && method === 'PATCH') return saveCampaign(state, user, input, config, now, id);
    if (id && !suffix && method === 'GET' && operation === 'report') return campaignReport(state, user, id, now);
    if (id && !suffix && method === 'POST' && ['launch', 'pause', 'resume', 'cancel', 'complete'].includes(operation)) {
      return changeCampaign(state, user, id, operation, input, config, now);
    }
  }
  if (resource === 'assignments' && id && !suffix && method === 'GET' && operation === 'receipt') {
    return signedAssignmentReceipt(state, user, id, now);
  }
  if (resource === 'assignments' && id && !suffix && method === 'POST') {
    if (operation === 'submissions') return sendSubmission(state, user, id, input, now);
    if (operation === 'reviews') return reviewSubmission(state, user, id, input, now);
  }
  if (resource === 'me' && id === 'qualifications') {
    if (!operation && method === 'GET') return qualificationView(state, user, now);
    if (operation && method === 'POST' && suffix === 'submissions') return submitQualification(state, user, operation, input, now);
    if (operation && method === 'POST' && suffix === 'appeal') return appealQualification(state, user, operation, input, now);
  }
  if (resource === 'me' && id === 'assignments') {
    if (!operation && method === 'GET') return listAssignments(state, user, now);
    if (operation && suffix === 'training-consent' && ['GET', 'PUT', 'DELETE'].includes(method)) {
      return trainingConsent(state, user, operation, method, input, now);
    }
    if (operation && suffix && method === 'POST') return contributorTransition(state, user, operation, suffix, input, now);
  }
  if (resource === 'me' && id === 'campaign-earnings' && !operation && method === 'GET') {
    return campaignEarnings(state, user);
  }
  missing(false, 'Route');
}
