import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PartnerEsimFaultStatusEnum } from '../../../../partners.enum';

/**
 * Đối tác báo một eSIM đã mua bị lỗi (#046).
 *
 * Chốt 02/10/2026: **admin duyệt tay** mới hoàn tiền. Nên bảng này tồn tại
 * thay vì hoàn thẳng: phải có chỗ ghi ai duyệt, duyệt lúc nào, hoàn bao nhiêu
 * — không có nó thì một khoản tiền ra khỏi quỹ mà không ai ký.
 *
 * Mỗi eSIM lỗi một dòng, không gộp theo đơn. Đối tác mua 100 cái và 3 cái lỗi
 * thì esim.vn duyệt từng cái: một dòng gộp buộc người duyệt phải chọn "duyệt
 * tất cả hoặc không gì cả".
 */
@Entity({ name: 'partner_esim_fault_report' })
export class PartnerEsimFaultReportEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: Number })
  partnerId!: number;

  @Index()
  @Column({ type: Number })
  orderId!: number;

  @Column({ type: String })
  orderNumber!: string;

  /** ICCID của eSIM bị lỗi, để esim.vn tra lại với nhà cung cấp. */
  @Index()
  @Column({ type: String })
  iccid!: string;

  @Column({ type: String })
  reason!: string;

  @Index()
  @Column({ type: String, default: PartnerEsimFaultStatusEnum.PENDING })
  status!: PartnerEsimFaultStatusEnum;

  /**
   * Số tiền hoàn, chốt tại lúc duyệt.
   *
   * Lưu lại chứ không tính lại khi cần: giá vốn của gói thay đổi theo tỷ giá,
   * nên tính lại sau vài tháng sẽ ra một con số khác con số đã chuyển.
   */
  @Column({ type: 'bigint', default: 0 })
  refundVnd!: number;

  @Column({ type: String, nullable: true })
  adminNote!: string | null;

  @Column({ type: Number, nullable: true })
  reviewedByAdminId!: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
