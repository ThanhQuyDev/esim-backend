import { ExtractJwt, Strategy } from 'passport-jwt';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtPayloadType } from './types/jwt-payload.type';
import { AllConfigType } from '../../config/config.type';
import { RoleEnum } from '../../roles/roles.enum';
import { SessionService } from '../../session/session.service';
import { PartnerEntity } from '../../partners/infrastructure/persistence/relational/entities/partner.entity';
import { PartnerStatusEnum } from '../../partners/partners.enum';

/** What a locked partner reads, at sign-in and when an open tab is cut off. */
export const PARTNER_LOCKED_MESSAGE =
  'Tài khoản của Quý đối tác hiện đang bị khóa, vui lòng liên hệ admin để được hỗ trợ';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService<AllConfigType>,
    private readonly sessionService: SessionService,
    @InjectRepository(PartnerEntity)
    private readonly partnersRepository: Repository<PartnerEntity>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.getOrThrow('auth.secret', { infer: true }),
    });
  }

  // Why we don't check if the user exists in the database:
  // https://github.com/brocoders/nestjs-boilerplate/blob/main/docs/auth.md#about-jwt-strategy
  //
  // Partners are the exception (doitac-1410 #004). "Khóa tài khoản" must sign
  // the partner out on every device, and an access token lives for months, so
  // deleting their sessions alone changed nothing until the token expired. A
  // partner's token is only honoured while its session still exists and the
  // account is not locked.
  public async validate(payload: JwtPayloadType): Promise<JwtPayloadType> {
    if (!payload.id) {
      throw new UnauthorizedException();
    }

    if (Number(payload.role?.id) === RoleEnum.partner) {
      const [session, partner] = await Promise.all([
        payload.sessionId
          ? this.sessionService.findById(payload.sessionId)
          : Promise.resolve(null),
        this.partnersRepository.findOne({
          where: { userId: Number(payload.id) },
          select: { id: true, status: true },
        }),
      ]);
      if (partner?.status === PartnerStatusEnum.DISABLED) {
        throw new UnauthorizedException(PARTNER_LOCKED_MESSAGE);
      }
      if (!session) {
        throw new UnauthorizedException();
      }
    }

    return payload;
  }
}
