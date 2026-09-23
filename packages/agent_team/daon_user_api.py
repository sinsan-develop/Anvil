"""Daon User host facade; no HTTP wiring, user authentication or external IO."""
from .sns_gateway import SNSGateway,SNSMessageEnvelope


class DaonUserAPI:
    def __init__(self,gateway):
        if type(gateway) is not SNSGateway:raise ValueError('CANONICAL_GATEWAY_REQUIRED')
        self._gateway=gateway

    def question(self,envelope,*,identity,execution_fence,now):
        if type(envelope) is not SNSMessageEnvelope:raise ValueError('DAON_QUESTION_REQUIRED')
        if type(envelope.channel) is not str or type(envelope.command) is not str or envelope.channel!='DAON_USER' or envelope.command!='QUESTION':
            raise ValueError('DAON_QUESTION_REQUIRED')
        return self._gateway.receive(envelope,identity=identity,execution_fence=execution_fence,now=now)

    def answer(self,question,*,identity,execution_fence,payload_ref,now):
        receipt=self._gateway.receipt(question,identity=identity,execution_fence=execution_fence,now=now)
        if receipt.to_dict()['channel']!='DAON_USER' or receipt.to_dict()['command']!='QUESTION':raise ValueError('DAON_QUESTION_REQUIRED')
        return self._gateway.prepare_result(question,identity=identity,execution_fence=execution_fence,payload_ref=payload_ref,now=now)


__all__=['DaonUserAPI']
